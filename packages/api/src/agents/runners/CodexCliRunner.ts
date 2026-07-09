import { spawn } from "node:child_process";
import readline from "node:readline";
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "node:child_process";
import type { AgentEvent, AgentRunInput, AgentRunner } from "../../types.js";
import {
  buildCallbackRuntimeEnv,
  defaultMcpServerLauncher,
  resolveCallbackBaseUrl,
  toTomlString,
} from "./CallbackRuntimeEnv.js";
import { buildAgentPromptParts, type AgentPromptParts } from "./CliPromptBuilder.js";
import { resolveInvocationWorkingDirectory } from "./WorkingDirectory.js";

export interface CodexCliRunnerOptions {
  command?: string;
  cwd?: string;
  apiBaseUrl?: string;
  callbackNetworkAccess?: boolean;
  mcpEnabled?: boolean;
  mcpServerCommand?: string;
  mcpServerArgs?: string[];
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  approvalPolicy?: "untrusted" | "on-request" | "never";
  timeoutMs?: number;
  spawn?: SpawnLike;
  env?: NodeJS.ProcessEnv;
}

type SpawnLike = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams;

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export class CodexCliRunner implements AgentRunner {
  private readonly command: string;
  private readonly cwd: string;
  private readonly apiBaseUrl: string;
  private readonly callbackNetworkAccess: boolean;
  private readonly mcpEnabled: boolean;
  private readonly mcpServerCommand: string;
  private readonly mcpServerArgs: string[];
  private readonly sandbox: "read-only" | "workspace-write" | "danger-full-access";
  private readonly approvalPolicy: "untrusted" | "on-request" | "never";
  private readonly timeoutMs: number;
  private readonly spawnImpl: SpawnLike;
  private readonly env: NodeJS.ProcessEnv;

  constructor(options: CodexCliRunnerOptions = {}) {
    this.env = options.env ?? process.env;
    this.command = options.command ?? process.env.CODEX_CLI_BIN ?? "codex";
    this.cwd = options.cwd ?? process.env.CODEX_RUNNER_CWD ?? process.cwd();
    this.apiBaseUrl = resolveCallbackBaseUrl({ apiBaseUrl: options.apiBaseUrl, env: this.env });
    this.callbackNetworkAccess =
      options.callbackNetworkAccess ?? parseBoolean(process.env.CODEX_RUNNER_CALLBACK_NETWORK) ?? true;
    this.mcpEnabled = options.mcpEnabled ?? process.env.CODEX_RUNNER_MCP_ENABLED !== "false";
    const defaultLauncher = defaultMcpServerLauncher(this.env);
    this.mcpServerCommand = options.mcpServerCommand ?? process.env.THE_TOWER_MCP_SERVER_COMMAND ?? defaultLauncher.command;
    this.mcpServerArgs =
      options.mcpServerArgs ?? parseArgs(process.env.THE_TOWER_MCP_SERVER_ARGS) ?? defaultLauncher.args;
    this.sandbox =
      options.sandbox ??
      parseSandbox(process.env.CODEX_RUNNER_SANDBOX) ??
      "danger-full-access";
    this.approvalPolicy = options.approvalPolicy ?? parseApproval(process.env.CODEX_RUNNER_APPROVAL) ?? "on-request";
    this.timeoutMs = options.timeoutMs ?? Number(process.env.CODEX_RUNNER_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    this.spawnImpl = options.spawn ?? spawn;
  }

  async *run(input: AgentRunInput): AsyncIterable<AgentEvent> {
    const { system, user } = buildCodexPrompt(input, this.apiBaseUrl);
    const prompt = `${system}\n\n---\n${user}`;
    const cwd = resolveInvocationWorkingDirectory(input, this.cwd);
    const args = this.buildArgs(input, cwd);
    const child = this.spawnImpl(this.command, args, {
      cwd,
      env: {
        ...this.env,
        ...buildCallbackRuntimeEnv(input, this.apiBaseUrl),
      },
      stdio: "pipe",
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, this.timeoutMs);
    const abort = () => child.kill("SIGTERM");
    input.signal.addEventListener("abort", abort, { once: true });

    let stderr = "";
    const stdoutLines: string[] = [];
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    try {
      child.stdin.end(prompt);
      const exit = waitForExit(child);
      const streamState: CodexJsonStreamState = { hadPriorAgentMessage: false };
      for await (const line of readLines(child.stdout)) {
        stdoutLines.push(line);
        if (input.signal.aborted) break;
        for (const event of parseCodexJsonLine(line, streamState)) {
          yield event;
        }
      }
      const result = await exit;
      if (input.signal.aborted) {
        yield { type: "error", error: "Codex CLI invocation was aborted." };
        return;
      }
      if (result.code !== 0) {
        yield {
          type: "error",
          error: formatCliError(result.code, result.signal, stderr, stdoutLines.join("\n")),
        };
        return;
      }
      yield { type: "done" };
    } finally {
      clearTimeout(timeout);
      input.signal.removeEventListener("abort", abort);
    }
  }

  private buildArgs(input: AgentRunInput, cwd: string): string[] {
    const callbackEnv = buildCallbackRuntimeEnv(input, this.apiBaseUrl);
    const args = [
      "--ask-for-approval",
      this.approvalPolicy,
      "exec",
      "--json",
      "--sandbox",
      this.sandbox,
      "--cd",
      cwd,
      "--color",
      "never",
    ];
    if (this.callbackNetworkAccess && this.sandbox === "workspace-write") {
      args.push(
        "--enable",
        "network_proxy",
        "-c",
        "sandbox_workspace_write.network_access=true",
        "-c",
        'features.network_proxy.domains={ "127.0.0.1" = "allow", "localhost" = "allow" }',
      );
    }
    if (this.mcpEnabled) args.push(...this.buildMcpConfigArgs(callbackEnv, input.workingDirectory));
    if (input.agent.model) args.push("--model", input.agent.model);
    args.push("-");
    return args;
  }

  private buildMcpConfigArgs(callbackEnv: Record<string, string>, workingDirectory?: string): string[] {
    const args = [
      "-c",
      `mcp_servers.thetower.command=${toTomlString(this.mcpServerCommand)}`,
      "-c",
      `mcp_servers.thetower.args=[${this.mcpServerArgs.map((arg) => toTomlString(arg)).join(", ")}]`,
      "-c",
      "mcp_servers.thetower.enabled=true",
      "-c",
      'mcp_servers.thetower.default_tools_approval_mode="approve"',
    ];

    for (const [key, value] of Object.entries(callbackEnv)) {
      args.push("-c", `mcp_servers.thetower.env.${key}=${toTomlString(value)}`);
    }
    if (workingDirectory?.trim()) {
      args.push("-c", `mcp_servers.thetower.env.ALLOWED_WORKSPACE_DIRS=${toTomlString(workingDirectory.trim())}`);
    }

    return args;
  }
}

export function buildCodexPrompt(input: AgentRunInput, apiBaseUrl = resolveCallbackBaseUrl()): AgentPromptParts {
  return buildAgentPromptParts(input, { providerToolDoc: codexCallbackDoc(input, apiBaseUrl) });
}

function codexCallbackDoc(input: AgentRunInput, apiBaseUrl: string): string {
  return [
    "## Callback API 能力入口",
    "",
    "协作行为、普通 @、callback 使用边界以当前启用 Skills 为准。本节只说明 Codex 可用的 HTTP callback 调用方式。",
    "",
    "凭证来自环境变量，不要在最终回复中泄露：",
    `- THE_TOWER_API_URL=${apiBaseUrl}`,
    `- THE_TOWER_AGENT_ID=${input.agent.id}`,
    `- THE_TOWER_THREAD_ID=${input.threadId}`,
    `- THE_TOWER_INVOCATION_ID=${input.invocationId}`,
    "- THE_TOWER_CALLBACK_TOKEN",
    "",
    "可用接口：",
    "- MCP tool: `mcp__thetower__post_message` / `mcp__thetower__get_thread_context`（优先使用）",
    "- MCP file tools: `mcp__thetower__read_file` / `mcp__thetower__read_file_slice` / `mcp__thetower__list_files` / `mcp__thetower__write_file`（当前 thread 绑定工作目录时可用）",
    "- MCP command tool: `mcp__thetower__shell_exec`（受限白名单命令，用于 pwd/ls/cat/read-only git/python3或node workspace脚本验证）",
    "- post-message: 运行中主动发消息回当前 thread",
    "- thread-context: 必要时读取当前 thread 上下文",
    "- file-tools: 通过 TheTower API 校验 invocation、callback token 和 workspace 边界后读写当前 workspace 内文件",
    "- shell-exec: 在 MCP server 本地执行受限命令，通过 ALLOWED_WORKSPACE_DIRS 校验边界；拒绝管道、重定向、变量展开、glob、workspace 外路径和危险命令",
    "",
    "如果 MCP 工具可用，优先使用 MCP；HTTP curl 只是 fallback。不要用 CLI 自带写文件能力绕过 TheTower MCP 文件工具。",
    "",
    "运行中写回消息示例：",
    "```bash",
    "curl -sS -X POST \"${THE_TOWER_API_URL:-http://127.0.0.1:3001}/api/callbacks/post-message\" \\",
    "  -H 'content-type: application/json' \\",
    "  --data \"$(node -e 'console.log(JSON.stringify({",
    "    invocationId: process.env.THE_TOWER_INVOCATION_ID,",
    "    callbackToken: process.env.THE_TOWER_CALLBACK_TOKEN,",
    "    agentId: process.env.THE_TOWER_AGENT_ID,",
    "    content: process.argv[1]",
    "  }))' '我正在协调大家')\"",
    "```",
    "",
    "运行中发送私密消息示例：",
    "```bash",
    "curl -sS -X POST \"${THE_TOWER_API_URL:-http://127.0.0.1:3001}/api/callbacks/post-message\" \\",
    "  -H 'content-type: application/json' \\",
    "  --data \"$(node -e 'console.log(JSON.stringify({",
    "    invocationId: process.env.THE_TOWER_INVOCATION_ID,",
    "    callbackToken: process.env.THE_TOWER_CALLBACK_TOKEN,",
    "    agentId: process.env.THE_TOWER_AGENT_ID,",
    "    content: process.argv[1],",
    "    visibility: \"private\",",
    "    visibleToAgentIds: [process.argv[2]]",
    "  }))' '@banshee 已完成300个测试用例' 'banshee')\"",
    "```",
    "",
    "结构化交接示例：",
    "```json",
    "{",
    "  \"content\": \"@banshee 请根据隐藏交接上下文继续实现。\",",
    "  \"visibility\": \"private\",",
    "  \"visibleToAgentIds\": [\"banshee\"],",
    "  \"handoffPayload\": {",
    "    \"toAgentIds\": [\"banshee\"],",
    "    \"what\": \"已完成方案分析。\",",
    "    \"why\": \"需要进入实现阶段。\",",
    "    \"tradeoff\": \"公开消息保持简短，细节放在隐藏交接。\",",
    "    \"openQuestions\": [],",
    "    \"nextAction\": \"实现并补测试。\"",
    "  }",
    "}",
    "```",
    "",
    "读取 thread 上下文示例：",
    "```bash",
    "node -e 'const q = new URLSearchParams({",
    "  threadId: process.env.THE_TOWER_THREAD_ID,",
    "  invocationId: process.env.THE_TOWER_INVOCATION_ID,",
    "  callbackToken: process.env.THE_TOWER_CALLBACK_TOKEN,",
    "  limit: \"20\"",
    "}); fetch(`${process.env.THE_TOWER_API_URL || \"http://127.0.0.1:3001\"}/api/callbacks/thread-context?${q}`).then(r => r.text()).then(console.log)'",
    "```",
  ].join("\n");
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<{
  code: number | null;
  signal: NodeJS.Signals | null;
}> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
}

async function* readLines(stream: NodeJS.ReadableStream): AsyncIterable<string> {
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) yield line;
}

function formatCliError(
  code: number | null,
  signal: NodeJS.Signals | null,
  stderr: string,
  stdout: string,
): string {
  const details = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n");
  const suffix = details ? `\n${details}` : "";
  return `Codex CLI exited with code ${code ?? "null"}${signal ? ` signal ${signal}` : ""}.${suffix}`;
}

interface CodexJsonStreamState {
  hadPriorAgentMessage: boolean;
}

export function parseCodexJsonLine(line: string, state: CodexJsonStreamState = { hadPriorAgentMessage: false }): AgentEvent[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  const parsed = safeJsonParse(trimmed);
  if (!parsed.ok) {
    return [{ type: "stream_text", content: line }];
  }
  return transformCodexJsonEvent(parsed.value, state);
}

function transformCodexJsonEvent(event: unknown, state: CodexJsonStreamState): AgentEvent[] {
  const e = asObject(event);
  if (!e) return [];
  const eventType = getStringProperty(e, "type");

  if (eventType === "error") {
    const message = getStringProperty(e, "message") ?? getStringProperty(asObject(getUnknownProperty(e, "error")), "message");
    return message ? [{ type: "error", error: message }] : [];
  }

  if (eventType === "turn.completed") {
    const usage = asObject(getUnknownProperty(e, "usage"));
    if (!usage) return [];
    const result = {
      source: "provider" as const,
      inputTokens: getNumberProperty(usage, "input_tokens"),
      outputTokens: getNumberProperty(usage, "output_tokens"),
      cacheReadTokens: getNumberProperty(usage, "cached_input_tokens"),
      lastTurnInputTokens: getNumberProperty(usage, "input_tokens"),
      contextUsedTokens: getNumberProperty(usage, "input_tokens"),
    };
    if (!Object.values(result).some((value) => typeof value === "number" && value > 0)) return [];
    return [{ type: "token_usage", usage: result }];
  }

  const item = asObject(getUnknownProperty(e, "item"));
  if (!item) return [];
  const itemType = getStringProperty(item, "type");

  if (eventType === "item.started") {
    if (itemType === "mcp_tool_call") {
      const server = getStringProperty(item, "server") ?? "unknown";
      const tool = getStringProperty(item, "tool") ?? "unknown";
      return [{ type: "tool_call", name: `mcp:${server}/${tool}`, input: getUnknownProperty(item, "arguments") ?? {} }];
    }
    if (itemType === "command_execution") {
      return [{ type: "tool_call", name: "command_execution", input: { command: getStringProperty(item, "command") ?? "" } }];
    }
    return [];
  }

  if (eventType !== "item.completed") return [];

  if (itemType === "agent_message") {
    const text = getStringProperty(item, "text");
    if (!text?.trim()) return [];
    const prefix = state.hadPriorAgentMessage ? "\n\n" : "";
    state.hadPriorAgentMessage = true;
    return [{ type: "text", content: `${prefix}${text}` }];
  }

  if (itemType === "reasoning") {
    const text = getStringProperty(item, "text");
    return text ? [{ type: "thinking", content: text, mode: "block" }] : [];
  }

  if (itemType === "command_execution") {
    const content = formatCodexCommandExecution(item);
    return content ? [{ type: "stream_text", content }] : [];
  }

  if (itemType === "mcp_tool_call") {
    const server = getStringProperty(item, "server") ?? "unknown";
    const tool = getStringProperty(item, "tool") ?? "unknown";
    const status = getStringProperty(item, "status") ?? "completed";
    const text = extractMcpResultText(getUnknownProperty(item, "result"));
    if (!text && status === "completed") return [];
    return [{ type: "stream_text", content: `mcp:${server}/${tool} (${status})${text ? `\n${text}` : ""}` }];
  }

  if (itemType === "file_change") {
    return [{ type: "tool_call", name: "file_change", input: getUnknownProperty(item, "changes") ?? {} }];
  }

  return [];
}

function formatCodexCommandExecution(item: Record<string, unknown>): string {
  const command = getStringProperty(item, "command");
  const status = getStringProperty(item, "status") ?? "completed";
  const exitCode = getNumberProperty(item, "exit_code");
  const output = getStringProperty(item, "aggregated_output")?.trimEnd();
  return [
    command ? `command: ${command}` : undefined,
    `status: ${status}`,
    exitCode !== undefined ? `exit_code: ${exitCode}` : undefined,
    output,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n");
}

function extractMcpResultText(result: unknown): string {
  const resultObject = asObject(result);
  const content = getUnknownProperty(resultObject, "content");
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      const block = asObject(item);
      if (!block || getStringProperty(block, "type") !== "text") return "";
      return getStringProperty(block, "text") ?? "";
    })
    .filter(Boolean)
    .join("\n");
}

function safeJsonParse(value: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false };
  }
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function getUnknownProperty(value: Record<string, unknown> | undefined, key: string): unknown {
  return value?.[key];
}

function getStringProperty(value: Record<string, unknown> | undefined, key: string): string | undefined {
  const item = value?.[key];
  return typeof item === "string" ? item : undefined;
}

function getNumberProperty(value: Record<string, unknown> | undefined, key: string): number | undefined {
  const item = value?.[key];
  return typeof item === "number" ? item : undefined;
}

function parseSandbox(value: string | undefined): CodexCliRunnerOptions["sandbox"] | undefined {
  if (value === "read-only" || value === "workspace-write" || value === "danger-full-access") return value;
  return undefined;
}

function parseApproval(value: string | undefined): CodexCliRunnerOptions["approvalPolicy"] | undefined {
  if (value === "untrusted" || value === "on-request" || value === "never") return value;
  return undefined;
}

function parseArgs(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}
