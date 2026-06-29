import { spawn } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { z } from "zod";
import type { ToolDef } from "../server-toolsets.js";
import { errorResult, successResult, type ToolResult } from "./result.js";

const MAX_OUTPUT_BYTES = 256 * 1024;
const TIMEOUT_MS = 30_000;
const SHELL_CONTROL_PATTERN = /[><|;&]/;
const SHELL_SUBSTITUTION_PATTERN = /[`]/;
const SHELL_NEWLINE_PATTERN = /[\n\r]/;
const SHELL_DOLLAR_PATTERN = /\$/;
const SHELL_GLOB_PATTERN = /[*?[\]]/;
const SHELL_BACKSLASH_PATTERN = /\\/;
const SHELL_QUOTED_SPACE_PATTERN = /(["'])[^"'\n]*\s[^"'\n]*\1/;
const SHELL_TILDE_USER_PATTERN = /(^|\s)~[A-Za-z0-9_]/;
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+-rf\s+\/(\s|$)/i, reason: "rm -rf / is always refused" },
  { pattern: /:\(\)\{\s*:\|:/i, reason: "fork bomb pattern refused" },
  { pattern: /(^|\s)--output(?:=|\s|$)/i, reason: "--output is refused" },
];

export const shellExecInputSchema = {
  commandLine: z.string().min(1).describe("The restricted command line to execute in an allowed workspace"),
  cwd: z.string().min(1).optional().describe("Optional cwd inside allowed workspace roots"),
};

export function getShellExecRefusalReason(commandLine: string): string | null {
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(commandLine)) return reason;
  }
  if (SHELL_CONTROL_PATTERN.test(commandLine)) return "shell control chars are refused";
  if (SHELL_SUBSTITUTION_PATTERN.test(commandLine)) return "shell substitution is refused";
  if (SHELL_NEWLINE_PATTERN.test(commandLine)) return "newlines are refused";
  if (SHELL_DOLLAR_PATTERN.test(commandLine)) return "variable expansion is refused";
  if (SHELL_BACKSLASH_PATTERN.test(commandLine)) return "backslash escapes are refused";
  if (SHELL_QUOTED_SPACE_PATTERN.test(commandLine)) return "quoted whitespace is refused";
  if (SHELL_GLOB_PATTERN.test(commandLine)) return "glob expansion is refused";
  if (SHELL_TILDE_USER_PATTERN.test(commandLine)) return "tilde-user expansion is refused";
  return null;
}

export function isAllowedShellCommand(commandLine: string): boolean {
  if (getShellExecRefusalReason(commandLine)) return false;
  const tokens = commandLine.trim().split(/\s+/).filter(Boolean);
  const command = tokens[0];
  const args = tokens.slice(1);
  if (command === "pwd") return args.length === 0;
  if (command === "ls") return true;
  if (command === "cat") return args.length > 0;
  if (command === "python3" || command === "node") return args.length > 0;
  if (command !== "git") return false;
  return ["log", "status", "rev-parse", "diff", "show"].includes(args[0]);
}

export function getPathBoundaryRefusalReason(commandLine: string, cwd: string): string | null {
  const allowedRoots = getAllowedWorkspaceDirs();
  if (!isPathAllowed(cwd, allowedRoots, true)) return `cwd outside allowed roots: ${cwd}`;
  const tokens = commandLine.trim().split(/\s+/).filter(Boolean);
  const command = tokens[0];
  const args = tokens.slice(1);
  const paths = getPathArgs(command, args);
  for (const rawPath of paths) {
    const resolvedPath = resolveTokenPath(rawPath, cwd);
    if (!isPathAllowed(resolvedPath, allowedRoots, true)) {
      return `path outside allowed roots: ${rawPath} (resolved to ${resolvedPath})`;
    }
  }
  return null;
}

export async function handleShellExec(input: { commandLine: string; cwd?: string }): Promise<ToolResult> {
  const commandLine = input.commandLine.trim();
  if (!commandLine) return errorResult("commandLine is required");

  const refusalReason = getShellExecRefusalReason(commandLine);
  if (refusalReason) return errorResult(`Refused: ${refusalReason}`);
  if (!isAllowedShellCommand(commandLine)) {
    return errorResult(
      "Refused: command is not on the whitelist (allowed: pwd, ls, cat, git log/status/rev-parse/diff/show, python3 workspace-script, node workspace-script). Shell control chars and expansion are denied.",
    );
  }

  const allowedRoots = getAllowedWorkspaceDirs();
  if (allowedRoots.length === 0) return errorResult("Refused: ALLOWED_WORKSPACE_DIRS is not configured");
  const cwd = input.cwd ? resolveWorkspacePath(input.cwd, pickDefaultCwd(allowedRoots)) : pickDefaultCwd(allowedRoots);
  if (!isPathAllowed(cwd, allowedRoots, true)) {
    return errorResult(`Refused: cwd outside allowed roots (${cwd}). See ALLOWED_WORKSPACE_DIRS env.`);
  }
  const pathRefusal = getPathBoundaryRefusalReason(commandLine, cwd);
  if (pathRefusal) return errorResult(`Refused: ${pathRefusal}`);

  const [command, ...args] = commandLine.split(/\s+/).filter(Boolean);
  return runCommand(command, args, cwd, commandLine);
}

export const shellTools: readonly ToolDef[] = [
  {
    name: "shell_exec",
    title: "Run restricted workspace command",
    description:
      "Run a restricted local command inside ALLOWED_WORKSPACE_DIRS. Whitelist only: pwd, ls, cat, read-only git commands, python3/node workspace scripts. Shell control, redirection, glob, variable expansion and paths outside allowed roots are refused.",
    inputSchema: shellExecInputSchema,
    handler: async (args) => handleShellExec(args as { commandLine: string; cwd?: string }),
  },
];

function runCommand(command: string, args: string[], cwd: string, commandLine: string): Promise<ToolResult> {
  const startedAt = Date.now();
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin",
        HOME: homedir(),
        GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? "",
      },
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout = truncate(stdout + chunk.toString("utf8"), MAX_OUTPUT_BYTES);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = truncate(stderr + chunk.toString("utf8"), MAX_OUTPUT_BYTES);
    });
    child.once("error", (err) => {
      clearTimeout(timeout);
      resolvePromise(formatCommandResult("error", null, Date.now() - startedAt, cwd, stdout, stderr + getErrorMessage(err)));
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      resolvePromise(
        formatCommandResult(timedOut ? "timeout" : code === 0 ? "success" : "error", code, Date.now() - startedAt, cwd, stdout, stderr),
      );
    });
  });
}

function formatCommandResult(
  status: "success" | "error" | "timeout",
  exitCode: number | null,
  durationMs: number,
  cwd: string,
  stdout: string,
  stderr: string,
): ToolResult {
  const parts = [`Status: ${status}`, `Exit code: ${exitCode ?? "n/a"}`, `Duration: ${durationMs}ms`, `Cwd: ${cwd}`];
  if (stdout) parts.push("", "--- stdout ---", stdout);
  if (stderr) parts.push("", "--- stderr ---", stderr);
  return status === "success" ? successResult(parts.join("\n")) : errorResult(parts.join("\n"));
}

function getPathArgs(command: string, args: string[]): string[] {
  if (command === "cat" || command === "ls") return args.filter((arg) => !arg.startsWith("-"));
  if (command === "python3" || command === "node") {
    const scriptIndex = args.findIndex((arg) => !arg.startsWith("-"));
    if (scriptIndex < 0) return [];
    return [args[scriptIndex], ...args.slice(scriptIndex + 1).filter(looksLikePath)];
  }
  return [];
}

function getAllowedWorkspaceDirs(): string[] {
  return (process.env.ALLOWED_WORKSPACE_DIRS ?? "")
    .split(delimiter)
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => resolve(part));
}

function pickDefaultCwd(allowedRoots: string[]): string {
  return allowedRoots[0] ?? process.cwd();
}

function resolveWorkspacePath(rawPath: string, defaultRoot: string): string {
  return resolve(isAbsolute(rawPath) ? rawPath : resolve(defaultRoot, rawPath));
}

function resolveTokenPath(rawToken: string, cwd: string): string {
  const token = stripOuterQuotes(rawToken);
  return resolve(isAbsolute(token) ? token : resolve(cwd, token));
}

function isPathAllowed(targetPath: string, allowedRoots: string[], mustExist: boolean): boolean {
  const resolvedTarget = resolve(targetPath);
  if (!allowedRoots.some((root) => isSameOrInside(resolvedTarget, root))) return false;
  const targetRealPath = tryRealpath(resolvedTarget);
  if (targetRealPath) return allowedRoots.some((root) => isSameOrInside(targetRealPath, tryRealpath(root) ?? root));
  if (mustExist) return false;
  const parentRealPath = tryRealpath(findDeepestExistingPath(resolvedTarget));
  return !!parentRealPath && allowedRoots.some((root) => isSameOrInside(parentRealPath, tryRealpath(root) ?? root));
}

function findDeepestExistingPath(targetPath: string): string {
  let current = resolve(targetPath);
  while (true) {
    try {
      statSync(current);
      return current;
    } catch (err) {
      const code = getErrorCode(err);
      if (code !== "ENOENT" && code !== "ENOTDIR") throw err;
    }
    const parent = dirname(current);
    if (parent === current) return current;
    current = parent;
  }
}

function isSameOrInside(targetPath: string, root: string): boolean {
  const rel = relative(resolve(root), resolve(targetPath));
  return rel === "" || (!!rel && !rel.startsWith("..") && !rel.startsWith(sep));
}

function looksLikePath(value: string): boolean {
  return value.includes("/") || value.startsWith(".");
}

function stripOuterQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) return value.slice(1, -1);
  }
  return value;
}

function truncate(value: string, maxBytes: number): string {
  return Buffer.byteLength(value, "utf8") <= maxBytes ? value : `${value.slice(0, maxBytes)}\n[truncated]`;
}

function tryRealpath(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

function getErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
