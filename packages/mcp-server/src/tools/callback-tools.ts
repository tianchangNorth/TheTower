import { getThreadContextInputShape, postAgentMessageInputShape } from "@the-tower/shared";
import type { ToolDef } from "../server-toolsets.js";
import { callbackToolResult } from "./result.js";

export const postMessageInputSchema = postAgentMessageInputShape;

export const getThreadContextInputSchema = getThreadContextInputShape;

export const callbackTools: readonly ToolDef[] = [
  {
    name: "post_message",
    title: "Post message",
    description:
      "Post an agent message to the current TheTower thread. Ordinary A2A routing is triggered by @handle at the start of its own content line or by targetAgents. Use visibility=private with visibleToAgentIds for private visibility without routing; private targetAgents are automatically visible.",
    inputSchema: postMessageInputSchema,
    handler: async (args, deps) =>
      callbackToolResult(async () => {
        const result = await deps.callbackClient.postMessage(args as Parameters<typeof deps.callbackClient.postMessage>[0]);
        return JSON.stringify(result);
      }),
  },
  {
    name: "get_thread_context",
    title: "Get thread context",
    description: "Read recent visible messages from the current TheTower thread.",
    inputSchema: getThreadContextInputSchema,
    handler: async (args, deps) =>
      callbackToolResult(async () => {
        const { limit } = args as { limit?: number };
        const result = await deps.callbackClient.getThreadContext(deps.threadId, limit);
        return JSON.stringify(result);
      }),
  },
];
