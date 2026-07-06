import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "node:child_process";
import readline from "node:readline";
import type { AgentEvent, AgentRunInput, AgentRunner, AgentTokenUsage } from "../../types.js";
import { buildCallbackRuntimeEnv, defaultMcpServerLauncher, resolveCallbackBaseUrl } from "./CallbackRuntimeEnv.js";
import { buildAgentPromptParts, type AgentPromptParts } from "./CliPromptBuilder.js";
import { ProcessLivenessProbe, type ProbeConfig } from "./ProcessLivenessProbe.js";
import { resolveInvocationWorkingDirectory } from "./WorkingDirectory.js";

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
  livenessProbe?: Partial<ProbeConfig> & { stallAutoKill?: boolean };
}

type SpawnLike = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams;

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const KILL_GRACE_MS = 3_000;
const MAX_CLI_ERROR_DETAIL_LENGTH = 1200;
const DATA_INSPECTION_ERROR_MESSAGE =
  "Claude CLI 请求被上游内容检查拒绝（data_inspection_failed）。请移除或缩短可能触发审查的最近消息/上下文后重试。";

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
  private readonly livenessProbe: Partial<ProbeConfig> & { stallAutoKill?: boolean };

  constructor(options: ClaudeCliRunnerOptions = {}) {
    this.command = options.command ?? process.env.CLAUDE_CLI_BIN ?? "claude";
    this.cwd = options.cwd ?? process.env.CLAUDE_RUNNER_CWD ?? process.cwd();
    // Default to bypassPermissions to match clowder-ai ClaudeAgentService
    // (hardcoded PERMISSION_MODE = 'bypassPermissions'). Headless `claude -p`
    // cannot answer interactive permission prompts, and the default guard mode
    // blocks Bash write/delete in non-git workspaces (the workspace mutation
    // guard is part of the permission system this mode disables). Override via
    // CLAUDE_RUNNER_PERMISSION_MODE (e.g. acceptEdits) to lock down. Safety
    // boundary lives in worktree isolation + persona, not the CLI guard.
    this.permissionMode = options.permissionMode ?? process.env.CLAUDE_RUNNER_PERMISSION_MODE ?? "bypassPermissions";
    this.timeoutMs = options.timeoutMs ?? Number(process.env.CLAUDE_RUNNER_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    this.mcpEnabled = options.mcpEnabled ?? process.env.CLAUDE_RUNNER_MCP_ENABLED !== "false";
    const defaultLauncher = defaultMcpServerLauncher(options.env ?? process.env);
    this.mcpServerCommand = options.mcpServerCommand ?? process.env.THE_TOWER_MCP_SERVER_COMMAND ?? defaultLauncher.command;
    this.mcpServerArgs =
      options.mcpServerArgs ?? parseArgs(process.env.THE_TOWER_MCP_SERVER_ARGS) ?? defaultLauncher.args;
    this.apiBaseUrl = resolveCallbackBaseUrl({ apiBaseUrl: options.apiBaseUrl, env: options.env ?? process.env });
    this.spawnImpl = options.spawn ?? spawn;
    this.env = options.env ?? process.env;
    this.livenessProbe = options.livenessProbe ?? {
      stallAutoKill: process.env.CLAUDE_RUNNER_LIVENESS_STALL_AUTO_KILL !== "false",
      softWarningMs: parseOptionalMs(process.env.CLAUDE_RUNNER_LIVENESS_SOFT_MS),
      stallWarningMs: parseOptionalMs(process.env.CLAUDE_RUNNER_LIVENESS_STALL_MS),
      sampleIntervalMs: parseOptionalMs(process.env.CLAUDE_RUNNER_LIVENESS_SAMPLE_MS),
    };
  }

  async *run(input: AgentRunInput): AsyncIterable<AgentEvent> {
    const { system, user } = buildClaudePromptParts(input, this.mcpEnabled);
    const cwd = resolveInvocationWorkingDirectory(input, this.cwd);
    const args = this.buildArgs(input.agent.model, input, system);
    const child = this.spawnImpl(this.command, args, {
      cwd,
      env: {
        ...this.env,
        ...buildCallbackRuntimeEnv(input, this.apiBaseUrl),
      },
      stdio: "pipe",
    });

    const probe =
      child.pid !== undefined ? new ProcessLivenessProbe(child.pid, this.livenessProbe) : undefined;
    const stallAutoKill = this.livenessProbe.stallAutoKill !== false;
    probe?.start();

    let killed = false;
    let childExited = false;
    let timedOut = false;
    let stallKilled = false;
    let escalationTimer: ReturnType<typeof setTimeout> | undefined;
    const killChild = (): void => {
      if (killed || childExited) return;
      killed = true;
      child.kill("SIGTERM");
      escalationTimer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* already gone */
        }
      }, KILL_GRACE_MS);
      escalationTimer.unref();
    };
    child.once("exit", () => {
      childExited = true;
    });

    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    const resetTimeout = (): void => {
      if (this.timeoutMs <= 0) return;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      timeoutTimer = setTimeout(() => {
        // busy-silent (CPU growing) extends the timeout unless the hard cap is hit.
        if (probe?.shouldExtendTimeout()) {
          const elapsed = Date.now() - startedAt;
          if (!probe.isHardCapExceeded(elapsed, this.timeoutMs)) {
            resetTimeout();
            return;
          }
        }
        timedOut = true;
        killChild();
      }, this.timeoutMs);
      timeoutTimer.unref();
    };
    if (this.timeoutMs > 0) resetTimeout();

    const abort = (): void => killChild();
    input.signal.addEventListener("abort", abort, { once: true });

    let stderr = "";
    const stdoutLines: string[] = [];
    // stderr is transport/reconnect noise, NOT user-visible output. It must not
    // reset the timeout or the liveness probe — clowder-ai's 30-min stall bug was
    // caused by stderr chatter keeping the timeout callback from ever firing.
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    try {
      child.stdin.end(user);
      const exit = waitForExit(child);
      let assistantText = "";
      let textYielded = false;
      let errorYielded = false;

      if (probe) {
        const lines = readLines(child.stdout)[Symbol.asyncIterator]();
        let pendingNext = lines.next();
        let pendingStallKill = false;
        const sampleMs = probe.config.sampleIntervalMs;
        for (;;) {
          if (input.signal.aborted) break;
          for (const warning of probe.drainWarnings()) {
            yield { type: "liveness", liveness: warning };
            if (warning.level === "stall" && warning.state === "idle_silent" && stallAutoKill) {
              // Deferred kill — only executed when the probe timer wins the next
              // race (no stdout arrived), so a recovery line pending in the stream
              // still gets a chance to cancel it (clowder-ai #774 R2).
              pendingStallKill = true;
            }
          }
          if (probe.getState() === "dead") {
            killChild();
            break;
          }

          let raceTimer: ReturnType<typeof setTimeout> | undefined;
          const raceResult = await Promise.race([
            pendingNext.then((r) => {
              if (raceTimer !== undefined) clearTimeout(raceTimer);
              return { source: "line" as const, result: r };
            }),
            new Promise<{ source: "probe" }>((resolve) => {
              raceTimer = setTimeout(() => resolve({ source: "probe" }), sampleMs);
            }),
          ]);

          if (raceResult.source === "probe") {
            if (pendingStallKill) {
              stallKilled = true;
              timedOut = true;
              killChild();
              break;
            }
            continue;
          }

          pendingStallKill = false;
          const { done, value: line } = raceResult.result;
          if (done) break;
          stdoutLines.push(line);
          resetTimeout();
          probe.notifyActivity();
          for (const ev of parseClaudeStreamLine(line, {
            onAssistantText: (text) => {
              assistantText += text;
            },
          })) {
            if (ev.type === "text") textYielded = true;
            if (ev.type === "error") errorYielded = true;
            yield ev;
          }
          pendingNext = lines.next();
        }
        await probe.flushPendingWarnings();
        for (const warning of probe.drainWarnings()) {
          yield { type: "liveness", liveness: warning };
          if (warning.level === "stall" && warning.state === "idle_silent" && stallAutoKill) {
            stallKilled = true;
            timedOut = true;
            killChild();
          }
        }
      } else {
        for await (const line of readLines(child.stdout)) {
          stdoutLines.push(line);
          if (input.signal.aborted) break;
          for (const ev of parseClaudeStreamLine(line, {
            onAssistantText: (text) => {
              assistantText += text;
            },
          })) {
            if (ev.type === "text") textYielded = true;
            if (ev.type === "error") errorYielded = true;
            yield ev;
          }
        }
      }

      const result = await exit;
      if (input.signal.aborted) {
        yield { type: "error", error: "Claude CLI invocation was aborted." };
        return;
      }
      if (stallKilled) {
        const stallMs = probe?.config.stallWarningMs ?? this.timeoutMs;
        yield {
          type: "error",
          error: `Claude CLI idle-silent stall auto-kill (no activity for ${Math.round(stallMs / 1000)}s).`,
        };
        return;
      }
      if (timedOut) {
        yield {
          type: "error",
          error: `Claude CLI response timeout (${Math.round(this.timeoutMs / 1000)}s).`,
        };
        return;
      }
      if (result.code !== 0) {
        if (errorYielded) return;
        yield {
          type: "error",
          error: formatCliError(result.code, result.signal, stderr, stdoutLines.join("\n")),
        };
        return;
      }
      if (!textYielded && assistantText.trim()) {
        yield { type: "text", content: assistantText.trim() };
      }
      yield { type: "done" };
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (escalationTimer !== undefined) clearTimeout(escalationTimer);
      probe?.stop();
      input.signal.removeEventListener("abort", abort);
      killChild();
    }
  }

  private buildArgs(model: string, input: AgentRunInput, system: string): string[] {
    const args = ["-p", "--output-format", "stream-json", "--verbose"];
    if (model) args.push("--model", model);
    if (system) args.push("--append-system-prompt", system);
    if (this.permissionMode) args.push("--permission-mode", this.permissionMode);
    if (this.mcpEnabled) {
      args.push("--strict-mcp-config");
      args.push(
        "--allowedTools",
        [
          "mcp__thetower__post_message",
          "mcp__thetower__get_thread_context",
          "mcp__thetower__read_file",
          "mcp__thetower__read_file_slice",
          "mcp__thetower__list_files",
          "mcp__thetower__write_file",
          "mcp__thetower__shell_exec",
        ].join(","),
      );
      args.push("--mcp-config", JSON.stringify(this.buildMcpConfig(input)));
    }
    return args;
  }

  private buildMcpConfig(input: AgentRunInput): ClaudeMcpConfig {
    const env = buildCallbackRuntimeEnv(input, this.apiBaseUrl);
    if (input.workingDirectory?.trim()) env.ALLOWED_WORKSPACE_DIRS = input.workingDirectory.trim();
    return buildClaudeMcpConfig({
      command: this.mcpServerCommand,
      args: this.mcpServerArgs,
      env,
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

const CLAUDE_MCP_DOC = [
  "运行中写回工具：",
  "- 你可以使用 TheTower MCP 工具 `mcp__thetower__post_message` 在执行过程中向当前 thread 发消息。",
  "- 何时使用 MCP post_message、何时使用最终回复行首 @，以当前启用 Skills 为准。",
  "- post_message 支持 visibility / visibleToAgentIds / targetAgents / routeMode / handoffPayload 等字段。",
  "- 你可以使用 `mcp__thetower__get_thread_context` 读取当前 thread 的最新可见消息。",
  "- 当前 thread 绑定工作目录时，优先使用 `mcp__thetower__read_file` / `mcp__thetower__read_file_slice` / `mcp__thetower__list_files` / `mcp__thetower__write_file` 读写 workspace 内文件。",
  "- 文件工具由 TheTower API 校验 invocation、callback token 和 workspace 边界；不要用 CLI 自带写文件能力绕过这些 MCP 文件工具。",
  "- 需要验证脚本或查看只读命令结果时，可使用 `mcp__thetower__shell_exec`；它在 MCP server 本地执行受限白名单命令，并通过 ALLOWED_WORKSPACE_DIRS 校验 workspace 边界。",
  "- MCP 工具只适用于 Claude CLI 动态挂载；不要假设其他 Provider 也有这些工具。",
].join("\n");

function buildClaudePromptParts(input: AgentRunInput, mcpEnabled: boolean): AgentPromptParts {
  return buildAgentPromptParts(input, { providerToolDoc: mcpEnabled ? CLAUDE_MCP_DOC : undefined });
}

export function parseClaudeStreamJson(stdout: string): { content: string; error?: string; usage?: AgentTokenUsage } {
  const assistantChunks: string[] = [];
  const deltaChunks: string[] = [];
  const resultChunks: string[] = [];
  const plainChunks: string[] = [];
  const errors: string[] = [];
  let usage: AgentTokenUsage | undefined;

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
      const extracted = extractClaudeUsage(event);
      if (hasUsageValues(extracted)) usage = extracted;
    }
  }

  if (errors.length > 0) return { content: "", error: normalizeClaudeErrorText(errors.join("\n")) };
  if (assistantChunks.length > 0) return withUsage(assistantChunks.join("\n"), usage);
  if (deltaChunks.length > 0) return withUsage(deltaChunks.join(""), usage);
  if (resultChunks.length > 0) return withUsage(resultChunks.join("\n"), usage);
  return withUsage(plainChunks.join("\n"), usage);
}

async function* readLines(stream: NodeJS.ReadableStream): AsyncIterable<string> {
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) yield line;
}

/**
 * Parse a single stream-json line into AgentEvents.
 * Streaming equivalent of parseClaudeStreamJson: emits thinking / stream_text / tool_call /
 * token_usage / text / error as each line arrives, instead of buffering the whole stdout.
 */
export function* parseClaudeStreamLine(
  line: string,
  options: { onAssistantText?: (text: string) => void } = {},
): Generator<AgentEvent> {
  const trimmed = line.trim();
  if (!trimmed) return;
  const parsed = safeJsonParse(trimmed);
  if (!parsed.ok) return;
  const event = parsed.value;
  const eventType = getStringProperty(event, "type");

  if (eventType === "error") {
    const errorText = extractErrorText(event);
    if (errorText) yield { type: "error", error: normalizeClaudeErrorText(errorText) };
    return;
  }

  if (eventType === "content_block_delta") {
    const delta = getObjectProperty(event, "delta");
    const deltaType = getStringProperty(delta, "type");
    if (deltaType === "text_delta") {
      const text = getStringProperty(delta, "text");
      if (text) yield { type: "stream_text", content: text };
    } else if (deltaType === "thinking_delta") {
      const text = getStringProperty(delta, "thinking") ?? getStringProperty(delta, "text");
      if (text) yield { type: "thinking", content: text };
    }
    return;
  }

  if (eventType === "assistant") {
    const message = getObjectProperty(event, "message") ?? asObject(event);
    const content = message ? getUnknownProperty(message, "content") : undefined;
    if (Array.isArray(content)) {
      for (const item of content) {
        const block = asObject(item);
        if (!block) continue;
        const blockType = getStringProperty(block, "type");
        if (blockType === "tool_use") {
          yield { type: "tool_call", name: getStringProperty(block, "name") ?? "unknown", input: getUnknownProperty(block, "input") };
        } else if (blockType === "thinking") {
          const text = getStringProperty(block, "thinking") ?? getStringProperty(block, "text");
          if (text) yield { type: "thinking", content: text };
        } else if (blockType === "text") {
          const text = getStringProperty(block, "text");
          if (text) options.onAssistantText?.(text);
        }
      }
    }
    return;
  }

  if (eventType === "result") {
    const extracted = extractClaudeUsage(event);
    if (hasUsageValues(extracted)) yield { type: "token_usage", usage: extracted };
    const resultText = getStringProperty(event, "result");
    if (resultText) yield { type: "text", content: resultText };
    return;
  }
}

export function extractClaudeUsage(event: unknown): AgentTokenUsage {
  const eventObject = asObject(event);
  const usage = getObjectProperty(eventObject, "usage");
  const rawInput = getNumberProperty(usage, "input_tokens") ?? 0;
  const cacheRead = getNumberProperty(usage, "cache_read_input_tokens") ?? 0;
  const cacheCreate = getNumberProperty(usage, "cache_creation_input_tokens") ?? 0;
  const totalInput = rawInput + cacheRead + cacheCreate;
  const result: AgentTokenUsage = { source: "provider" };
  if (totalInput > 0) result.inputTokens = totalInput;
  const outputTokens = getNumberProperty(usage, "output_tokens");
  if (outputTokens !== undefined) result.outputTokens = outputTokens;
  if (cacheRead > 0) result.cacheReadTokens = cacheRead;
  if (cacheCreate > 0) result.cacheCreationTokens = cacheCreate;
  const costUsd = getNumberProperty(eventObject, "total_cost_usd");
  if (costUsd !== undefined) result.costUsd = costUsd;
  const durationMs = getNumberProperty(eventObject, "duration_ms");
  if (durationMs !== undefined) result.durationMs = durationMs;
  const durationApiMs = getNumberProperty(eventObject, "duration_api_ms");
  if (durationApiMs !== undefined) result.durationApiMs = durationApiMs;
  const numTurns = getNumberProperty(eventObject, "num_turns");
  if (numTurns !== undefined) result.numTurns = numTurns;
  const contextWindow = extractClaudeContextWindow(eventObject);
  if (contextWindow !== undefined) {
    result.contextWindowSize = contextWindow;
    result.budgetTokens = contextWindow;
  }
  if (totalInput > 0) result.lastTurnInputTokens = totalInput;
  return result;
}

function extractClaudeContextWindow(event: Record<string, unknown> | undefined): number | undefined {
  const modelUsage = getObjectProperty(event, "modelUsage") ?? getObjectProperty(event, "model_usage");
  if (!modelUsage) return undefined;
  for (const value of Object.values(modelUsage)) {
    const data = asObject(value);
    const contextWindow = getNumberProperty(data, "contextWindow") ?? getNumberProperty(data, "context_window");
    if (contextWindow !== undefined) return contextWindow;
  }
  return undefined;
}

function withUsage(content: string, usage: AgentTokenUsage | undefined): { content: string; usage?: AgentTokenUsage } {
  return usage ? { content, usage } : { content };
}

function hasUsageValues(usage: AgentTokenUsage): boolean {
  return Object.keys(usage).some((key) => key !== "source");
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

function getNumberProperty(value: unknown, key: string): number | undefined {
  const property = getUnknownProperty(value, key);
  return typeof property === "number" ? property : undefined;
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
  const normalizedDetails = normalizeClaudeErrorText(details);
  if (normalizedDetails === DATA_INSPECTION_ERROR_MESSAGE) return normalizedDetails;

  const suffix = normalizedDetails ? `\n${normalizedDetails}` : "";
  return `Claude CLI exited with code ${code ?? "null"}${signal ? ` signal ${signal}` : ""}.${suffix}`;
}

function normalizeClaudeErrorText(value: string): string {
  const text = value.trim();
  if (!text) return "";
  if (isDataInspectionError(text)) return DATA_INSPECTION_ERROR_MESSAGE;
  return truncateCliErrorDetail(text);
}

function isDataInspectionError(value: string): boolean {
  return (
    value.includes("data_inspection_failed") ||
    value.includes("Input text data may contain inappropriate content.")
  );
}

function truncateCliErrorDetail(value: string): string {
  if (value.length <= MAX_CLI_ERROR_DETAIL_LENGTH) return value;
  return `${value.slice(0, MAX_CLI_ERROR_DETAIL_LENGTH)}\n... [truncated]`;
}

function parseArgs(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
