import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "node:child_process";
import type { AgentEvent, AgentRunInput, AgentRunner } from "../../types.js";
import { buildAgentPrompt } from "./CliPromptBuilder.js";

export interface ClaudeCliRunnerOptions {
  command?: string;
  cwd?: string;
  permissionMode?: string;
  timeoutMs?: number;
  mcpEnabled?: boolean;
  mcpServerCommand?: string;
  mcpServerArgs?: string[];
  apiBaseUrl?: string;
  spawn?: SpawnLike;
  env?: NodeJS.ProcessEnv;
}

type SpawnLike = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams;

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export class ClaudeCliRunner implements AgentRunner {
  private readonly command: string;
  private readonly cwd: string;
  private readonly permissionMode?: string;
  private readonly timeoutMs: number;
  private readonly mcpEnabled: boolean;
  private readonly mcpServerCommand: string;
  private readonly mcpServerArgs: string[];
  private readonly apiBaseUrl: string;
  private readonly spawnImpl: SpawnLike;
  private readonly env: NodeJS.ProcessEnv;

  constructor(options: ClaudeCliRunnerOptions = {}) {
    this.command = options.command ?? process.env.CLAUDE_CLI_BIN ?? "claude";
    this.cwd = options.cwd ?? process.env.CLAUDE_RUNNER_CWD ?? process.cwd();
    this.permissionMode = options.permissionMode ?? process.env.CLAUDE_RUNNER_PERMISSION_MODE;
    this.timeoutMs = options.timeoutMs ?? Number(process.env.CLAUDE_RUNNER_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    this.mcpEnabled = options.mcpEnabled ?? process.env.CLAUDE_RUNNER_MCP_ENABLED !== "false";
    const defaultLauncher = defaultMcpServerLauncher();
    this.mcpServerCommand = options.mcpServerCommand ?? process.env.THE_TOWER_MCP_SERVER_COMMAND ?? defaultLauncher.command;
    this.mcpServerArgs =
      options.mcpServerArgs ?? parseArgs(process.env.THE_TOWER_MCP_SERVER_ARGS) ?? defaultLauncher.args;
    this.apiBaseUrl = options.apiBaseUrl ?? process.env.THE_TOWER_API_URL ?? "http://127.0.0.1:3001";
    this.spawnImpl = options.spawn ?? spawn;
    this.env = options.env ?? process.env;
  }

  async *run(input: AgentRunInput): AsyncIterable<AgentEvent> {
    const prompt = buildClaudePrompt(input, this.mcpEnabled);
    const args = this.buildArgs(input.agent.model, input);
    const child = this.spawnImpl(this.command, args, {
      cwd: this.cwd,
      env: {
        ...this.env,
        THE_TOWER_AGENT_ID: input.agent.id,
        THE_TOWER_THREAD_ID: input.threadId,
        THE_TOWER_INVOCATION_ID: input.invocationId,
        THE_TOWER_CALLBACK_TOKEN: input.callbackToken,
        THE_TOWER_API_URL: this.apiBaseUrl,
      },
      stdio: "pipe",
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, this.timeoutMs);
    const abort = () => child.kill("SIGTERM");
    input.signal.addEventListener("abort", abort, { once: true });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    try {
      child.stdin.end(prompt);
      const exit = await waitForExit(child);
      if (input.signal.aborted) {
        yield { type: "error", error: "Claude CLI invocation was aborted." };
        return;
      }
      if (exit.code !== 0) {
        yield {
          type: "error",
          error: formatCliError(exit.code, exit.signal, stderr, stdout),
        };
        return;
      }

      const parsed = parseClaudeStreamJson(stdout);
      if (parsed.error) {
        yield { type: "error", error: parsed.error };
        return;
      }

      const content = parsed.content.trim();
      if (content) yield { type: "text", content };
      yield { type: "done" };
    } finally {
      clearTimeout(timeout);
      input.signal.removeEventListener("abort", abort);
    }
  }

  private buildArgs(model: string, input: AgentRunInput): string[] {
    const args = ["-p", "--output-format", "stream-json", "--verbose"];
    if (model) args.push("--model", model);
    if (this.permissionMode) args.push("--permission-mode", this.permissionMode);
    if (this.mcpEnabled) {
      args.push("--strict-mcp-config");
      args.push("--allowedTools", "mcp__thetower__post_message,mcp__thetower__get_thread_context");
      args.push("--mcp-config", JSON.stringify(this.buildMcpConfig(input)));
    }
    return args;
  }

  private buildMcpConfig(input: AgentRunInput): ClaudeMcpConfig {
    return buildClaudeMcpConfig({
      command: this.mcpServerCommand,
      args: this.mcpServerArgs,
      env: {
        THE_TOWER_API_URL: this.apiBaseUrl,
        THE_TOWER_AGENT_ID: input.agent.id,
        THE_TOWER_THREAD_ID: input.threadId,
        THE_TOWER_INVOCATION_ID: input.invocationId,
        THE_TOWER_CALLBACK_TOKEN: input.callbackToken,
      },
    });
  }
}

export interface ClaudeMcpServerConfigInput {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface ClaudeMcpConfig {
  mcpServers: {
    thetower: ClaudeMcpServerConfigInput;
  };
}

export function buildClaudeMcpConfig(input: ClaudeMcpServerConfigInput): ClaudeMcpConfig {
  return {
    mcpServers: {
      thetower: input,
    },
  };
}

function buildClaudePrompt(input: AgentRunInput, mcpEnabled: boolean): string {
  const base = buildAgentPrompt(input);
  if (!mcpEnabled) return base;
  return [
    base,
    "",
    "运行中写回工具：",
    "- 你可以使用 TheTower MCP 工具 `mcp__thetower__post_message` 在执行过程中向当前 thread 发消息。",
    "- 默认是公开消息；当你需要使用私密传输时，传 visibility=\"private\" 和 visibleToAgentIds。",
    "- 如果没有显式用 visibility=\"private\" 写回成功，不要声称消息已私密送达、仅某 Agent 可见或不会让其他 Agent 看到。",
    "- 需要完整交接但不想把五件套展示给用户时，传 handoffPayload；服务端会把它只注入给目标 Agent prompt。",
    "- 需要接力给其他 Agent 时，优先用 `mcp__thetower__post_message` 写出行首 @handle 的交接消息，而不是等最终回复。",
    "- 你可以使用 `mcp__thetower__get_thread_context` 读取当前 thread 的最新可见消息。",
    "- MCP 工具只适用于 Claude CLI 动态挂载；不要假设其他 Provider 也有这些工具。",
  ].join("\n");
}

export function parseClaudeStreamJson(stdout: string): { content: string; error?: string } {
  const assistantChunks: string[] = [];
  const deltaChunks: string[] = [];
  const resultChunks: string[] = [];
  const plainChunks: string[] = [];
  const errors: string[] = [];

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const parsed = safeJsonParse(line);
    if (!parsed.ok) {
      plainChunks.push(line);
      continue;
    }

    const event = parsed.value;
    const error = extractErrorText(event);
    if (error) errors.push(error);

    const eventType = getStringProperty(event, "type");
    const assistantText = extractAssistantText(event);
    if (assistantText) assistantChunks.push(assistantText);

    if (eventType === "content_block_delta") {
      const delta = getObjectProperty(event, "delta");
      const deltaText = getStringProperty(delta, "text");
      if (deltaText) deltaChunks.push(deltaText);
    }

    if (eventType === "result") {
      const result = getStringProperty(event, "result");
      if (result) resultChunks.push(result);
    }
  }

  if (errors.length > 0) return { content: "", error: errors.join("\n") };
  if (assistantChunks.length > 0) return { content: assistantChunks.join("\n") };
  if (deltaChunks.length > 0) return { content: deltaChunks.join("") };
  if (resultChunks.length > 0) return { content: resultChunks.join("\n") };
  return { content: plainChunks.join("\n") };
}

function extractAssistantText(event: unknown): string {
  const eventObject = asObject(event);
  if (!eventObject) return "";

  const directContent = getStringProperty(eventObject, "content");
  if (directContent && isAssistantEvent(eventObject)) return directContent;

  const message = getObjectProperty(eventObject, "message");
  if (message && getStringProperty(message, "role") === "assistant") {
    return extractTextContent(getUnknownProperty(message, "content"));
  }

  if (isAssistantEvent(eventObject)) {
    return extractTextContent(getUnknownProperty(eventObject, "content"));
  }

  return "";
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      const block = asObject(item);
      if (!block) return "";
      return getStringProperty(block, "text");
    })
    .filter(Boolean)
    .join("");
}

function extractErrorText(event: unknown): string {
  const eventObject = asObject(event);
  if (!eventObject) return "";
  if (getStringProperty(eventObject, "type") !== "error") return "";
  const directMessage = getStringProperty(eventObject, "message");
  if (directMessage) return directMessage;
  const error = getUnknownProperty(eventObject, "error");
  if (typeof error === "string") return error;
  const errorObject = asObject(error);
  return getStringProperty(errorObject, "message") ?? "";
}

function isAssistantEvent(event: Record<string, unknown>): boolean {
  return getStringProperty(event, "type") === "assistant" || getStringProperty(event, "role") === "assistant";
}

function safeJsonParse(value: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch {
    return { ok: false };
  }
}

function getObjectProperty(value: unknown, key: string): Record<string, unknown> | undefined {
  return asObject(getUnknownProperty(value, key));
}

function getStringProperty(value: unknown, key: string): string | undefined {
  const property = getUnknownProperty(value, key);
  return typeof property === "string" ? property : undefined;
}

function getUnknownProperty(value: unknown, key: string): unknown {
  const object = asObject(value);
  return object ? object[key] : undefined;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
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

function formatCliError(
  code: number | null,
  signal: NodeJS.Signals | null,
  stderr: string,
  stdout: string,
): string {
  const details = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n");
  const suffix = details ? `\n${details}` : "";
  return `Claude CLI exited with code ${code ?? "null"}${signal ? ` signal ${signal}` : ""}.${suffix}`;
}

function parseArgs(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultMcpServerLauncher(): { command: string; args: string[] } {
  const projectRoot = process.env.PROJECT_ROOT ?? resolve(process.cwd(), "../..");
  const distPath = resolve(projectRoot, "packages/mcp-server/dist/index.js");
  if (existsSync(distPath)) return { command: "node", args: [distPath] };
  const packageTsxPath = resolve(projectRoot, "packages/mcp-server/node_modules/.bin/tsx");
  if (existsSync(packageTsxPath)) {
    return {
      command: packageTsxPath,
      args: [resolve(projectRoot, "packages/mcp-server/src/index.ts")],
    };
  }
  return {
    command: resolve(projectRoot, "node_modules/.bin/tsx"),
    args: [resolve(projectRoot, "packages/mcp-server/src/index.ts")],
  };
}
