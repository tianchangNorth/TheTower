import { z } from "zod";
import type { ToolDef } from "../server-toolsets.js";
import { callbackToolResult } from "./result.js";

export const postMessageInputSchema = {
  content: z.string().min(1),
  targetAgents: z.array(z.string().min(1)).optional(),
  routeMode: z.enum(["single", "serial", "fanout", "parallel"]).optional(),
  visibility: z.enum(["public", "private"]).optional(),
  visibleToAgentIds: z.array(z.string().min(1)).optional(),
  handoffPayload: z
    .object({
      fromAgentId: z.string().min(1).optional(),
      toAgentIds: z.array(z.string().min(1)).min(1),
      triggerMessageId: z.string().min(1).optional(),
      what: z.string().min(1),
      why: z.string().min(1),
      tradeoff: z.string().min(1),
      openQuestions: z.array(z.string()).optional(),
      nextAction: z.string().min(1),
      evidenceRefs: z
        .array(
          z.object({
            kind: z.enum(["message", "file", "command", "url", "other"]),
            ref: z.string().min(1),
            note: z.string().min(1).optional(),
          }),
        )
        .optional(),
      riskLevel: z.enum(["low", "medium", "high"]).optional(),
      createdAt: z.number().int().positive().optional(),
    })
    .optional(),
  replyTo: z.string().min(1).optional(),
};

export const getThreadContextInputSchema = {
  limit: z.number().int().min(1).max(200).optional(),
};

export const callbackTools: readonly ToolDef[] = [
  {
    name: "post_message",
    title: "Post message",
    description:
      "Post an agent message to the current TheTower thread. targetAgents is explicit routing, routeMode can be single/serial/fanout/parallel. Use visibility=private with visibleToAgentIds when private transport is needed, or handoffPayload for structured A2A handoff.",
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
