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
  return buildAgentPrompt(input);
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
