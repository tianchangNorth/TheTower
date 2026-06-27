import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "node:child_process";
import type { AgentEvent, AgentRunInput, AgentRunner } from "../../types.js";
import { buildAgentPrompt } from "./CliPromptBuilder.js";

export interface CodexCliRunnerOptions {
  command?: string;
  cwd?: string;
  apiBaseUrl?: string;
  callbackNetworkAccess?: boolean;
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
  private readonly sandbox: "read-only" | "workspace-write" | "danger-full-access";
  private readonly approvalPolicy: "untrusted" | "on-request" | "never";
  private readonly timeoutMs: number;
  private readonly spawnImpl: SpawnLike;
  private readonly env: NodeJS.ProcessEnv;

  constructor(options: CodexCliRunnerOptions = {}) {
    this.command = options.command ?? process.env.CODEX_CLI_BIN ?? "codex";
    this.cwd = options.cwd ?? process.env.CODEX_RUNNER_CWD ?? process.cwd();
    this.apiBaseUrl =
      options.apiBaseUrl ?? options.env?.THE_TOWER_API_URL ?? process.env.THE_TOWER_API_URL ?? "http://127.0.0.1:3001";
    this.callbackNetworkAccess =
      options.callbackNetworkAccess ?? parseBoolean(process.env.CODEX_RUNNER_CALLBACK_NETWORK) ?? true;
    this.sandbox =
      options.sandbox ??
      parseSandbox(process.env.CODEX_RUNNER_SANDBOX) ??
      (this.callbackNetworkAccess ? "workspace-write" : "read-only");
    this.approvalPolicy = options.approvalPolicy ?? parseApproval(process.env.CODEX_RUNNER_APPROVAL) ?? "never";
    this.timeoutMs = options.timeoutMs ?? Number(process.env.CODEX_RUNNER_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    this.spawnImpl = options.spawn ?? spawn;
    this.env = options.env ?? process.env;
  }

  async *run(input: AgentRunInput): AsyncIterable<AgentEvent> {
    const prompt = buildCodexPrompt(input, this.apiBaseUrl);
    const tempDir = await mkdtemp(join(tmpdir(), "the-tower-codex-"));
    const outputFile = join(tempDir, "last-message.txt");
    const args = this.buildArgs(input.agent.model, outputFile);
    const child = this.spawnImpl(this.command, args, {
      cwd: this.cwd,
      env: {
        ...this.env,
        THE_TOWER_API_URL: this.apiBaseUrl,
        THE_TOWER_AGENT_ID: input.agent.id,
        THE_TOWER_THREAD_ID: input.threadId,
        THE_TOWER_INVOCATION_ID: input.invocationId,
        THE_TOWER_CALLBACK_TOKEN: input.callbackToken,
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
        yield { type: "error", error: "Codex CLI invocation was aborted." };
        return;
      }
      if (exit.code !== 0) {
        yield {
          type: "error",
          error: formatCliError(exit.code, exit.signal, stderr, stdout),
        };
        return;
      }

      const content = (await readOutput(outputFile, stdout)).trim();
      if (content) yield { type: "text", content };
      yield { type: "done" };
    } finally {
      clearTimeout(timeout);
      input.signal.removeEventListener("abort", abort);
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private buildArgs(model: string, outputFile: string): string[] {
    const args = [
      "--ask-for-approval",
      this.approvalPolicy,
      "exec",
      "--sandbox",
      this.sandbox,
      "--cd",
      this.cwd,
      "--output-last-message",
      outputFile,
      "--color",
      "never",
    ];
    if (this.callbackNetworkAccess && this.sandbox === "workspace-write") {
      args.push(
        "-c",
        "sandbox_workspace_write.network_access=true",
        "-c",
        "features.network_proxy.enabled=true",
        "-c",
        'features.network_proxy.domains={ "127.0.0.1" = "allow", "localhost" = "allow" }',
      );
    }
    if (model) args.push("--model", model);
    args.push("-");
    return args;
  }
}

export function buildCodexPrompt(input: AgentRunInput, apiBaseUrl = process.env.THE_TOWER_API_URL ?? "http://127.0.0.1:3001"): string {
  return [
    buildAgentPrompt(input),
    "",
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
    "- post-message: 运行中主动发消息回当前 thread",
    "- thread-context: 必要时读取当前 thread 上下文",
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
    "    targetAgents: [process.argv[2]],",
    "    routeMode: \"single\",",
    "    visibility: \"private\",",
    "    visibleToAgentIds: [process.argv[2]]",
    "  }))' '@banshee 已完成300个测试用例' 'banshee')\"",
    "```",
    "",
    "结构化交接示例：",
    "```json",
    "{",
    "  \"content\": \"@banshee 请根据隐藏交接上下文继续实现。\",",
    "  \"targetAgents\": [\"banshee\"],",
    "  \"routeMode\": \"single\",",
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

async function readOutput(outputFile: string, stdout: string): Promise<string> {
  try {
    return await readFile(outputFile, "utf8");
  } catch {
    return stdout;
  }
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

function parseSandbox(value: string | undefined): CodexCliRunnerOptions["sandbox"] | undefined {
  if (value === "read-only" || value === "workspace-write" || value === "danger-full-access") return value;
  return undefined;
}

function parseApproval(value: string | undefined): CodexCliRunnerOptions["approvalPolicy"] | undefined {
  if (value === "untrusted" || value === "on-request" || value === "never") return value;
  return undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}
