import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "node:child_process";
import type { AgentEvent, AgentRunInput, AgentRunner, Message } from "../../types.js";

export interface CodexCliRunnerOptions {
  command?: string;
  cwd?: string;
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
  private readonly sandbox: "read-only" | "workspace-write" | "danger-full-access";
  private readonly approvalPolicy: "untrusted" | "on-request" | "never";
  private readonly timeoutMs: number;
  private readonly spawnImpl: SpawnLike;
  private readonly env: NodeJS.ProcessEnv;

  constructor(options: CodexCliRunnerOptions = {}) {
    this.command = options.command ?? process.env.CODEX_CLI_BIN ?? "codex";
    this.cwd = options.cwd ?? process.env.CODEX_RUNNER_CWD ?? process.cwd();
    this.sandbox = options.sandbox ?? parseSandbox(process.env.CODEX_RUNNER_SANDBOX) ?? "read-only";
    this.approvalPolicy = options.approvalPolicy ?? parseApproval(process.env.CODEX_RUNNER_APPROVAL) ?? "never";
    this.timeoutMs = options.timeoutMs ?? Number(process.env.CODEX_RUNNER_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    this.spawnImpl = options.spawn ?? spawn;
    this.env = options.env ?? process.env;
  }

  async *run(input: AgentRunInput): AsyncIterable<AgentEvent> {
    const prompt = buildCodexPrompt(input);
    const tempDir = await mkdtemp(join(tmpdir(), "the-tower-codex-"));
    const outputFile = join(tempDir, "last-message.txt");
    const args = this.buildArgs(input.agent.model, outputFile);
    const child = this.spawnImpl(this.command, args, {
      cwd: this.cwd,
      env: {
        ...this.env,
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
    if (model) args.push("--model", model);
    args.push("-");
    return args;
  }
}

export function buildCodexPrompt(input: AgentRunInput): string {
  return [
    `你是多 Agent 平台中的一个 Agent。`,
    "",
    `Agent ID: ${input.agent.id}`,
    `Agent 名称: ${input.agent.displayName}`,
    `当前 threadId: ${input.threadId}`,
    `当前 invocationId: ${input.invocationId}`,
    "",
    "你的角色设定：",
    input.agent.rolePrompt || "无额外角色设定。",
    "",
    "通信规则：",
    "- 你看到的是同一个 thread 的公开上下文，不是私聊。",
    "- 只有在需要把任务继续转交给其他 Agent 时，才在回复中写对应 mention，例如 @agent-b。",
    "- 确认、致谢、总结、已完成这类消息不要带任何 @mention。",
    "- 不要伪造其他 Agent 的发言。",
    "- 最终只输出你要写回 thread 的内容。",
    "",
    "最近上下文：",
    formatMessages(input.messages),
  ].join("\n");
}

function formatMessages(messages: Message[]): string {
  if (messages.length === 0) return "(empty)";
  return messages
    .map((message, index) => {
      const sender =
        message.senderType === "agent" && message.senderId
          ? `agent:${message.senderId}`
          : message.senderType;
      const mentions = message.mentions.length > 0 ? ` mentions=${message.mentions.join(",")}` : "";
      return [
        `--- message ${index + 1} ---`,
        `id=${message.id} sender=${sender}${mentions} createdAt=${new Date(message.createdAt).toISOString()}`,
        message.content,
      ].join("\n");
    })
    .join("\n");
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
