import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import type { CallbackClient } from "./index.js";
import { callbackTools, fileTools, shellTools, type ToolResult } from "./tools/index.js";

export type ToolProfile = "full" | "collab-only" | "read-only";

export interface ToolsetEnv {
  profile?: ToolProfile;
}

export interface ToolDeps {
  callbackClient: CallbackClient;
  threadId: string;
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  handler: (args: unknown, deps: ToolDeps) => Promise<ToolResult>;
}

export interface ToolAnnotation {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  openWorldHint: boolean;
}

const A_READ_LOCAL: ToolAnnotation = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
};

const A_WRITE_SAFE: ToolAnnotation = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
};

const A_DESTRUCTIVE: ToolAnnotation = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: false,
};

export const EXPLICIT_TOOL_ANNOTATIONS: Record<string, ToolAnnotation> = {
  post_message: A_WRITE_SAFE,
  get_thread_context: A_READ_LOCAL,
  read_file: A_READ_LOCAL,
  read_file_slice: A_READ_LOCAL,
  list_files: A_READ_LOCAL,
  write_file: A_WRITE_SAFE,
  shell_exec: A_DESTRUCTIVE,
};

const COLLAB_TOOL_SOURCES: readonly ToolDef[] = [...callbackTools];
const WORKSPACE_TOOL_SOURCES: readonly ToolDef[] = [...fileTools];
const SHELL_TOOL_SOURCES: readonly ToolDef[] = [...shellTools];
export const FULL_TOOL_SOURCES: readonly ToolDef[] = [...COLLAB_TOOL_SOURCES, ...WORKSPACE_TOOL_SOURCES, ...SHELL_TOOL_SOURCES];
const READ_ONLY_ALLOWED_TOOLS = new Set(["get_thread_context", "read_file", "read_file_slice", "list_files"]);

/** 工具目录（不含 handler）：给 API 的 /api/mcp-tools 目录页用。无副作用，纯静态。 */
export interface McpToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
}

export function listMcpToolDefs(): McpToolDef[] {
  return FULL_TOOL_SOURCES.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export function parseToolsetEnv(env: NodeJS.ProcessEnv = process.env): ToolsetEnv {
  const rawProfile = env.THE_TOWER_MCP_PROFILE?.trim();
  if (!rawProfile) return { profile: "full" };
  if (rawProfile === "full" || rawProfile === "collab-only" || rawProfile === "read-only") {
    return { profile: rawProfile };
  }
  throw new Error(`Unknown THE_TOWER_MCP_PROFILE: "${rawProfile}". Valid profiles: full, collab-only, read-only`);
}

export function buildCollabTools(_env?: ToolsetEnv): readonly ToolDef[] {
  return COLLAB_TOOL_SOURCES;
}

export function buildWorkspaceTools(env: ToolsetEnv = parseToolsetEnv()): readonly ToolDef[] {
  if (env.profile === "collab-only") return [];
  if (env.profile === "read-only") return WORKSPACE_TOOL_SOURCES.filter((tool) => READ_ONLY_ALLOWED_TOOLS.has(tool.name));
  return WORKSPACE_TOOL_SOURCES;
}

export function buildFullTools(env: ToolsetEnv = parseToolsetEnv()): readonly ToolDef[] {
  if (env.profile === "collab-only") return buildCollabTools(env);
  if (env.profile === "read-only") return FULL_TOOL_SOURCES.filter((tool) => READ_ONLY_ALLOWED_TOOLS.has(tool.name));
  return FULL_TOOL_SOURCES;
}

export function registerCollabToolset(server: McpServer, deps: ToolDeps, env?: ToolsetEnv): void {
  registerTools(server, buildCollabTools(env), deps);
}

export function registerWorkspaceToolset(server: McpServer, deps: ToolDeps, env?: ToolsetEnv): void {
  registerTools(server, buildWorkspaceTools(env), deps);
}

export function registerFullToolset(server: McpServer, deps: ToolDeps, env?: ToolsetEnv): void {
  registerTools(server, buildFullTools(env), deps);
}

type RegisteredToolHandler = (args: unknown) => Promise<ToolResult>;
type TypeErasedToolRegistration = (
  name: string,
  config: {
    title: string;
    description: string;
    inputSchema: Record<string, z.ZodTypeAny>;
    annotations: ToolAnnotation;
  },
  cb: RegisteredToolHandler,
) => void;

function registerTools(server: McpServer, tools: readonly ToolDef[], deps: ToolDeps): void {
  const registerToolErased = server.registerTool.bind(server) as unknown as TypeErasedToolRegistration;
  for (const tool of tools) {
    const annotations = EXPLICIT_TOOL_ANNOTATIONS[tool.name];
    if (!annotations) throw new Error(`Missing MCP tool annotation for ${tool.name}`);
    registerToolErased(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations,
      },
      async (args: unknown) => tool.handler(args, deps),
    );
  }
}
