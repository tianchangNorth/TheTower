import { z } from "zod";
import type { ToolDef } from "../server-toolsets.js";
import { callbackToolResult } from "./result.js";

export const readFileInputSchema = {
  path: z.string().min(1),
};

export const readFileSliceInputSchema = {
  path: z.string().min(1),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1).optional(),
};

export const listFilesInputSchema = {
  path: z.string().min(1).optional(),
  recursive: z.boolean().optional(),
};

export const writeFileInputSchema = {
  path: z.string().min(1),
  content: z.string(),
};

export const fileTools: readonly ToolDef[] = [
  {
    name: "read_file",
    title: "Read workspace file",
    description:
      "Read a UTF-8 text file inside the current thread working directory. Refuses paths outside the workspace and large files; use read_file_slice for bounded reads.",
    inputSchema: readFileInputSchema,
    handler: async (args, deps) =>
      callbackToolResult(async () => {
        const result = await deps.callbackClient.readFile(args as { path: string });
        return `File: ${result.path}\n${result.content}`;
      }),
  },
  {
    name: "read_file_slice",
    title: "Read workspace file slice",
    description:
      "Read a bounded, line-numbered UTF-8 text range inside the current thread working directory. Defaults to 120 lines and refuses ranges over 400 lines.",
    inputSchema: readFileSliceInputSchema,
    handler: async (args, deps) =>
      callbackToolResult(async () => {
        const result = await deps.callbackClient.readFileSlice(
          args as { path: string; startLine: number; endLine?: number },
        );
        return `File slice: ${result.path}:${result.startLine}-${result.endLine}\n${result.content}`;
      }),
  },
  {
    name: "list_files",
    title: "List workspace files",
    description:
      "List files in a directory inside the current thread working directory. Set recursive=true for a bounded recursive listing. Skips .git and node_modules directories.",
    inputSchema: listFilesInputSchema,
    handler: async (args, deps) =>
      callbackToolResult(async () => {
        const result = await deps.callbackClient.listFiles(args as { path?: string; recursive?: boolean });
        const entries = result.entries.length > 0 ? result.entries.join("\n") : "(empty)";
        return [`Directory: ${result.path}`, result.truncated ? "(truncated)" : undefined, entries]
          .filter(Boolean)
          .join("\n");
      }),
  },
  {
    name: "write_file",
    title: "Write workspace file",
    description:
      "Write UTF-8 text to a file inside the current thread working directory. Creates parent directories. Overwrites the full file and refuses paths outside the workspace.",
    inputSchema: writeFileInputSchema,
    handler: async (args, deps) =>
      callbackToolResult(async () => {
        const result = await deps.callbackClient.writeFile(args as { path: string; content: string });
        return `Wrote ${result.bytes} bytes to ${result.path}`;
      }),
  },
];
