import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type { EventBus } from "../events/EventBus.js";
import type { AgentRuntimeStatusRegistry } from "../agents/AgentRuntimeStatusRegistry.js";
import type { ThreadStore } from "../stores/ThreadStore.js";
import type {
  ListFilesInput,
  OperationContext,
  ReadFileInput,
  ReadFileSliceInput,
  WorkspaceFileListResult,
  WorkspaceFileReadResult,
  WorkspaceFileSliceResult,
  WorkspaceFileWriteResult,
  WriteFileInput,
} from "../types.js";
import { resolveThreadWorkspace } from "../workspaces/WorkspaceResolver.js";
import { assertOperationCapability } from "./OperationContextService.js";

const MAX_READ_BYTES = 512 * 1024;
const MAX_WRITE_BYTES = 2 * 1024 * 1024;
const DEFAULT_SLICE_LINES = 120;
const MAX_SLICE_LINES = 400;
const MAX_LIST_ENTRIES = 1_000;
const DENIED_PATH_SEGMENTS = new Set([".git"]);
const SKIPPED_LIST_DIRS = new Set([".git", "node_modules"]);

export class WorkspaceFileService {
  constructor(
    private readonly deps: {
      threadStore: ThreadStore;
      events: EventBus;
      runtimeStatuses: AgentRuntimeStatusRegistry;
    },
  ) {}

  async readFile(context: OperationContext, input: ReadFileInput): Promise<WorkspaceFileReadResult> {
    assertOperationCapability(context, "workspace:read");
    const workspaceContext = await this.resolveContext(context);
    try {
      const filePath = await resolveWorkspacePath(workspaceContext.workingDirectory, input.path, "read");
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error(`Not a file: ${filePath}`);
      if (info.size > MAX_READ_BYTES) {
        throw new Error(`File is too large to read fully (${info.size} bytes, max ${MAX_READ_BYTES}). Use read_file_slice.`);
      }
      this.publishAudit(workspaceContext, "read_file", filePath, false);
      return { path: filePath, content: await readFile(filePath, "utf8") };
    } catch (err) {
      this.publishAudit(workspaceContext, "read_file", input.path, true, getErrorMessage(err));
      throw err;
    }
  }

  async readFileSlice(
    context: OperationContext,
    input: ReadFileSliceInput,
  ): Promise<WorkspaceFileSliceResult> {
    assertOperationCapability(context, "workspace:read");
    const workspaceContext = await this.resolveContext(context);
    try {
      const filePath = await resolveWorkspacePath(workspaceContext.workingDirectory, input.path, "read");
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error(`Not a file: ${filePath}`);
      const endLine = input.endLine ?? input.startLine + DEFAULT_SLICE_LINES - 1;
      if (endLine < input.startLine) throw new Error("Invalid line range: endLine must be greater than startLine.");
      if (endLine - input.startLine + 1 > MAX_SLICE_LINES) {
        throw new Error(`Invalid line range: max ${MAX_SLICE_LINES} lines per request.`);
      }

      const lines: string[] = [];
      let currentLine = 0;
      const stream = createReadStream(filePath, { encoding: "utf8" });
      const reader = createInterface({ input: stream, crlfDelay: Infinity });
      for await (const line of reader) {
        currentLine++;
        if (currentLine < input.startLine) continue;
        if (currentLine > endLine) {
          reader.close();
          stream.destroy();
          break;
        }
        lines.push(`${currentLine}: ${line}`);
      }
      if (lines.length === 0) throw new Error(`Line range starts beyond EOF: ${filePath} has ${currentLine} line(s).`);
      this.publishAudit(workspaceContext, "read_file_slice", filePath, false);
      return {
        path: filePath,
        startLine: input.startLine,
        endLine: input.startLine + lines.length - 1,
        content: lines.join("\n"),
      };
    } catch (err) {
      this.publishAudit(workspaceContext, "read_file_slice", input.path, true, getErrorMessage(err));
      throw err;
    }
  }

  async listFiles(context: OperationContext, input: ListFilesInput): Promise<WorkspaceFileListResult> {
    assertOperationCapability(context, "workspace:read");
    const workspaceContext = await this.resolveContext(context);
    try {
      const dirPath = await resolveWorkspacePath(workspaceContext.workingDirectory, input.path ?? ".", "read");
      const info = await stat(dirPath);
      if (!info.isDirectory()) throw new Error(`Not a directory: ${dirPath}`);
      const entries = input.recursive
        ? await listRecursive(dirPath, dirPath)
        : (await readdir(dirPath, { withFileTypes: true }))
            .filter((entry) => !SKIPPED_LIST_DIRS.has(entry.name))
            .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
      this.publishAudit(workspaceContext, "list_files", dirPath, false);
      return {
        path: dirPath,
        entries: entries.slice(0, MAX_LIST_ENTRIES),
        truncated: entries.length > MAX_LIST_ENTRIES,
      };
    } catch (err) {
      this.publishAudit(workspaceContext, "list_files", input.path ?? ".", true, getErrorMessage(err));
      throw err;
    }
  }

  async writeFile(context: OperationContext, input: WriteFileInput): Promise<WorkspaceFileWriteResult> {
    assertOperationCapability(context, "workspace:write");
    const workspaceContext = await this.resolveContext(context);
    const bytes = Buffer.byteLength(input.content, "utf8");
    if (bytes > MAX_WRITE_BYTES) throw new Error(`Refused: content is ${bytes} bytes, max is ${MAX_WRITE_BYTES}.`);
    try {
      const filePath = await resolveWorkspacePath(workspaceContext.workingDirectory, input.path, "write");
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, input.content, "utf8");
      this.publishAudit(workspaceContext, "write_file", filePath, false, undefined, bytes);
      return { path: filePath, bytes };
    } catch (err) {
      this.publishAudit(workspaceContext, "write_file", input.path, true, getErrorMessage(err), bytes);
      throw err;
    }
  }

  private async resolveContext(context: OperationContext): Promise<WorkspaceFileContext> {
    const thread = this.deps.threadStore.get(context.threadId);
    const workspace = await resolveThreadWorkspace(thread);
    if (!workspace.workingDirectory) throw new Error("thread has no bound working directory");
    return {
      threadId: context.threadId,
      invocationId: context.invocationId,
      agentId: context.caller.agentId,
      workingDirectory: workspace.workingDirectory,
    };
  }

  private publishAudit(
    context: WorkspaceFileContext,
    tool: "read_file" | "read_file_slice" | "list_files" | "write_file",
    path: string,
    denied: boolean,
    reason?: string,
    bytes?: number,
  ): void {
    const now = Date.now();
    if (!denied) {
      const status = this.deps.runtimeStatuses.setStatus({
        agentId: context.agentId,
        threadId: context.threadId,
        invocationId: context.invocationId,
        status: "tool_calling",
        currentToolName: tool,
      });
      this.deps.events.publish({
        type: "agent.status",
        threadId: context.threadId,
        invocationId: context.invocationId,
        agentId: context.agentId,
        status,
        createdAt: now,
      });
    }
    this.deps.events.publish({
      type: "workspace.file_tool",
      threadId: context.threadId,
      invocationId: context.invocationId,
      agentId: context.agentId,
      tool,
      path,
      bytes,
      denied,
      reason,
      createdAt: now,
    });
  }
}

interface WorkspaceFileContext {
  threadId: string;
  invocationId: string;
  agentId: string;
  workingDirectory: string;
}

async function resolveWorkspacePath(
  workingDirectory: string,
  rawPath: string,
  mode: "read" | "write",
): Promise<string> {
  const trimmed = rawPath.trim();
  if (!trimmed) throw new Error("path is required");
  const workspacePath = resolve(workingDirectory);
  const targetPath = isAbsolute(trimmed) ? resolve(trimmed) : resolve(workspacePath, trimmed);
  assertInsideWorkspace(targetPath, workspacePath);
  assertNoDeniedSegments(targetPath, workspacePath);

  const workspaceRealPath = await realpath(workspacePath);
  const targetRealPath = await realpath(targetPath).catch(() => null);
  if (targetRealPath) assertInsideWorkspace(targetRealPath, workspaceRealPath);

  const boundaryPath = targetRealPath ?? (await findDeepestExistingPath(targetPath));
  if (!boundaryPath) throw new Error(`Access denied: no existing parent path for ${targetPath}`);
  const boundaryRealPath = await realpath(boundaryPath);
  assertInsideWorkspace(boundaryRealPath, workspaceRealPath);
  if (mode === "read" && !targetRealPath) throw new Error(`File not found: ${targetPath}`);
  return targetPath;
}

async function listRecursive(dirPath: string, basePath: string): Promise<string[]> {
  const output: string[] = [];
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIPPED_LIST_DIRS.has(entry.name)) continue;
    const fullPath = resolve(dirPath, entry.name);
    const relativePath = relative(basePath, fullPath);
    if (entry.isDirectory()) {
      output.push(`${relativePath}/`);
      if (output.length >= MAX_LIST_ENTRIES) return output;
      output.push(...(await listRecursive(fullPath, basePath)));
    } else {
      output.push(relativePath);
    }
    if (output.length >= MAX_LIST_ENTRIES) return output;
  }
  return output;
}

async function findDeepestExistingPath(targetPath: string): Promise<string | null> {
  let current = resolve(targetPath);
  while (true) {
    try {
      await stat(current);
      return current;
    } catch (err) {
      const code = getErrorCode(err);
      if (code !== "ENOENT" && code !== "ENOTDIR") throw err;
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function assertInsideWorkspace(targetPath: string, workspacePath: string): void {
  const rel = relative(workspacePath, targetPath);
  if (rel === "" || (!!rel && !rel.startsWith("..") && !rel.startsWith(sep))) return;
  throw new Error(`Access denied: ${targetPath} is outside workspace ${workspacePath}`);
}

function assertNoDeniedSegments(targetPath: string, workspacePath: string): void {
  const rel = relative(workspacePath, targetPath);
  const denied = rel.split(/[\\/]+/).find((segment) => DENIED_PATH_SEGMENTS.has(segment));
  if (denied) throw new Error(`Access denied: ${denied} is not available through workspace file tools.`);
}

function getErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
