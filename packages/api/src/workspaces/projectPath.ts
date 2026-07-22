import { realpath, stat } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, delimiter, relative, resolve, sep } from "node:path";

export type ProjectPathValidationResult =
  | { ok: true; path: string }
  | {
      ok: false;
      reason: "missing" | "not_directory" | "outside_allowed_roots" | "denied" | "io_error";
      message?: string;
    };

const DEFAULT_ALLOWED_ROOT = "/Users/xuchenyang";

export function defaultWorkspaceName(projectPath: string): string {
  return basename(resolve(projectPath)) || "Workspace";
}

export async function validateProjectPathDetailed(rawPath: string): Promise<ProjectPathValidationResult> {
  const trimmed = rawPath.trim();
  if (!trimmed) return { ok: false, reason: "missing", message: "Project path is required." };

  const expanded = expandHome(trimmed);
  const absolutePath = resolve(expanded);
  let resolvedPath: string;
  try {
    resolvedPath = await realpath(absolutePath);
  } catch (err) {
    const code = getErrorCode(err);
    if (code === "ENOENT") return { ok: false, reason: "missing", message: "Project path does not exist." };
    if (code === "ENOTDIR") return { ok: false, reason: "not_directory", message: "Project path is not a directory." };
    return { ok: false, reason: "io_error", message: (err as Error).message };
  }

  try {
    const info = await stat(resolvedPath);
    if (!info.isDirectory()) return { ok: false, reason: "not_directory", message: "Project path is not a directory." };
  } catch (err) {
    return { ok: false, reason: "io_error", message: (err as Error).message };
  }

  if (isDeniedProjectPath(resolvedPath)) {
    return { ok: false, reason: "denied", message: "Project path is denied by workspace safety policy." };
  }
  if (!isUnderAnyRoot(resolvedPath, getAllowedRoots())) {
    return {
      ok: false,
      reason: "outside_allowed_roots",
      message: `Project path must be under allowed roots: ${getAllowedRoots().join(", ")}`,
    };
  }
  return { ok: true, path: resolvedPath };
}

export function getAllowedRoots(env: NodeJS.ProcessEnv = process.env): string[] {
  const envRoots = splitPaths(env.THE_TOWER_PROJECT_ALLOWED_ROOTS);
  const defaults = [DEFAULT_ALLOWED_ROOT];
  const roots = envRoots.length === 0 ? defaults : env.THE_TOWER_PROJECT_ALLOWED_ROOTS_APPEND === "true" ? [...defaults, ...envRoots] : envRoots;
  return uniqueResolved(roots.map(expandHome));
}

export function getDeniedRoots(env: NodeJS.ProcessEnv = process.env): string[] {
  return uniqueResolved([...defaultDeniedRoots(), ...splitPaths(env.THE_TOWER_PROJECT_DENIED_ROOTS).map(expandHome)]);
}

export function isUnderAnyRoot(path: string, roots: string[]): boolean {
  return roots.some((root) => isSameOrInside(path, root));
}

export function buildWorkspaceFingerprint(workingDirectory: string): string {
  return resolve(workingDirectory);
}

function isDeniedProjectPath(path: string): boolean {
  if (getDeniedRoots().some((root) => (root === sep ? resolve(path) === root : isSameOrInside(path, root)))) return true;
  return path.split(sep).includes("node_modules") || path.split(sep).includes(".git");
}

function defaultDeniedRoots(): string[] {
  return [
    "/",
    "/System",
    "/Library",
    "/Applications",
    resolve(homedir(), ".ssh"),
    resolve(homedir(), ".gnupg"),
    resolve(homedir(), ".codex"),
    resolve(homedir(), ".claude"),
  ];
}

function isSameOrInside(path: string, root: string): boolean {
  const rel = relative(resolve(root), resolve(path));
  return rel === "" || (!!rel && !rel.startsWith("..") && !rel.startsWith(sep));
}

function splitPaths(value: string | undefined): string[] {
  return (value ?? "")
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueResolved(values: string[]): string[] {
  return [...new Set(values.map(canonicalizeExistingPath))];
}

function canonicalizeExistingPath(value: string): string {
  const absolute = resolve(value);
  try {
    return realpathSync(absolute);
  } catch {
    return absolute;
  }
}

function expandHome(value: string): string {
  if (value === "~") return homedir();
  if (value.startsWith(`~${sep}`)) return resolve(homedir(), value.slice(2));
  return value;
}

function getErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}
