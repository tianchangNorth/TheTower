import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import { AgentRegistry } from "./agents/AgentRegistry.js";
import type { createAppContext } from "./bootstrap.js";
import { normalizeAgentModel, updateAgentInCatalog } from "./config/AgentConfigLoader.js";
import { defaultWorkspaceName, validateProjectPathDetailed } from "./workspaces/projectPath.js";

type AppContext = ReturnType<typeof createAppContext>;

const routeModeSchema = z.enum(["single", "serial", "fanout", "parallel"]);

const postMessageSchema = z.object({
  threadId: z.string().min(1).optional(),
  content: z.string().min(1),
  projectPath: z.string().min(1).optional(),
  workspaceId: z.string().min(1).optional(),
  targetAgents: z.array(z.string().min(1)).optional(),
  routeMode: routeModeSchema.optional(),
});

const workspaceSchema = z.object({
  projectPath: z.string().min(1),
  name: z.string().min(1).optional(),
});

const evidenceRefSchema = z.object({
  kind: z.enum(["message", "file", "command", "url", "other"]),
  ref: z.string().min(1),
  note: z.string().min(1).optional(),
});

const callbackHandoffPayloadSchema = z.object({
  fromAgentId: z.string().min(1).optional(),
  toAgentIds: z.array(z.string().min(1)).min(1),
  triggerMessageId: z.string().min(1).optional(),
  what: z.string().min(1),
  why: z.string().min(1),
  tradeoff: z.string().min(1),
  openQuestions: z.array(z.string()).optional(),
  nextAction: z.string().min(1),
  evidenceRefs: z.array(evidenceRefSchema).optional(),
  riskLevel: z.enum(["low", "medium", "high"]).optional(),
  createdAt: z.number().int().positive().optional(),
});

const callbackPostMessageSchema = z.object({
  invocationId: z.string().min(1),
  callbackToken: z.string().min(1),
  agentId: z.string().min(1),
  content: z.string().min(1),
  targetAgents: z.array(z.string().min(1)).optional(),
  routeMode: routeModeSchema.optional(),
  visibility: z.enum(["public", "private"]).optional(),
  visibleToAgentIds: z.array(z.string().min(1)).optional(),
  handoffPayload: callbackHandoffPayloadSchema.optional(),
  replyTo: z.string().min(1).optional(),
});

const callbackFileBaseSchema = z.object({
  invocationId: z.string().min(1),
  callbackToken: z.string().min(1),
  agentId: z.string().min(1),
});

const callbackReadFileSchema = callbackFileBaseSchema.extend({
  path: z.string().min(1),
});

const callbackReadFileSliceSchema = callbackFileBaseSchema.extend({
  path: z.string().min(1),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1).optional(),
});

const callbackListFilesSchema = callbackFileBaseSchema.extend({
  path: z.string().min(1).optional(),
  recursive: z.boolean().optional(),
});

const callbackWriteFileSchema = callbackFileBaseSchema.extend({
  path: z.string().min(1),
  content: z.string(),
});

const updateAgentSchema = z
  .object({
    displayName: z.string().min(1).optional(),
    mentionHandles: z.array(z.string().min(1)).min(1).optional(),
    provider: z.enum(["codex", "claude", "gemini", "openai-api", "custom", "mock"]).optional(),
    model: z.string().min(1).optional(),
    rolePrompt: z.string().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "at least one field is required");

const updateThreadSchema = z
  .object({
    mode: z.enum(["debug", "play"]).optional(),
    projectPath: z.string().min(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "at least one field is required");

export async function registerRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  app.get("/health", async () => ({ ok: true }));

  app.get("/api/agents", async () => ({ agents: ctx.agentRegistry.list() }));

  app.get("/api/workspaces", async () => ({ workspaces: ctx.stores.workspaceStore.list() }));

  app.post("/api/workspaces/validate", async (request, reply) => {
    const body = workspaceSchema.pick({ projectPath: true }).parse(request.body);
    const result = await validateProjectPathDetailed(body.projectPath);
    if (!result.ok) {
      return {
        ok: false,
        reason: result.reason,
        error: result.message ?? `Invalid project path: ${result.reason}`,
      };
    }
    return { ok: true, projectPath: result.path, name: defaultWorkspaceName(result.path) };
  });

  app.post("/api/workspaces", async (request, reply) => {
    const body = workspaceSchema.parse(request.body);
    const result = await validateProjectPathDetailed(body.projectPath);
    if (!result.ok) {
      return reply.code(400).send({ error: result.message ?? `Invalid project path: ${result.reason}` });
    }
    const now = Date.now();
    const workspace = ctx.stores.workspaceStore.upsert({
      id: nanoid(),
      name: body.name?.trim() || defaultWorkspaceName(result.path),
      projectPath: result.path,
      trustedAt: now,
      lastOpenedAt: now,
      createdAt: now,
    });
    return { workspace };
  });

  app.patch("/api/agents/:agentId", async (request, reply) => {
    const params = z.object({ agentId: z.string().min(1) }).parse(request.params);
    const body = updateAgentSchema.parse(request.body);
    const existing = ctx.stores.agentStore.get(params.agentId);
    if (!existing) return reply.code(404).send({ error: "agent not found" });

    const updated = { ...existing, ...body };
    updated.model = normalizeAgentModel(updated.provider, updated.model);
    const nextAgents = ctx.stores.agentStore
      .list()
      .map((agent) => (agent.id === updated.id ? updated : agent));

    try {
      const validationRegistry = new AgentRegistry();
      validationRegistry.replaceAll(nextAgents);
      updateAgentInCatalog(updated, ctx.projectRoot);
      ctx.stores.agentStore.upsert(updated);
      ctx.agentRegistry.replaceAll(nextAgents);
      return { agent: updated };
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.get("/api/threads", async () => ({ threads: ctx.stores.threadStore.list() }));

  app.patch("/api/threads/:threadId", async (request, reply) => {
    const params = z.object({ threadId: z.string().min(1) }).parse(request.params);
    const body = updateThreadSchema.parse(request.body);
    let projectPath: string | null | undefined;
    try {
      projectPath = await normalizeProjectPathPatch(body.projectPath, ctx);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
    const thread = ctx.stores.threadStore.update(params.threadId, {
      ...(body.mode ? { mode: body.mode } : {}),
      ...(body.projectPath !== undefined ? { projectPath } : {}),
    });
    if (!thread) return reply.code(404).send({ error: "thread not found" });
    return { thread };
  });

  app.delete("/api/threads/:threadId", async (request, reply) => {
    const params = z.object({ threadId: z.string().min(1) }).parse(request.params);
    const deleted = ctx.stores.threadStore.delete(params.threadId);
    if (!deleted) return reply.code(404).send({ error: "thread not found" });
    return { threadId: params.threadId };
  });

  app.get("/api/threads/:threadId/messages", async (request) => {
    const params = z.object({ threadId: z.string().min(1) }).parse(request.params);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }).parse(request.query);
    return { messages: ctx.stores.messageStore.listByThread(params.threadId, query.limit ?? 100) };
  });

  app.get("/api/threads/:threadId/invocations", async (request) => {
    const params = z.object({ threadId: z.string().min(1) }).parse(request.params);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }).parse(request.query);
    return { invocations: ctx.stores.invocationStore.listByThread(params.threadId, query.limit ?? 30) };
  });

  app.post("/api/threads/:threadId/messages/:messageId/reveal", async (request, reply) => {
    const params = z
      .object({
        threadId: z.string().min(1),
        messageId: z.string().min(1),
      })
      .parse(request.params);
    try {
      return { message: ctx.communication.revealMessage(params) };
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.post("/api/messages", async (request, reply) => {
    try {
      const body = postMessageSchema.parse(request.body);
      const result = await ctx.communication.postUserMessage(body);
      return reply.code(202).send(result);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.post("/api/callbacks/post-message", async (request, reply) => {
    try {
      const body = callbackPostMessageSchema.parse(request.body);
      const result = await ctx.communication.postAgentMessage(body);
      return result;
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.get("/api/callbacks/thread-context", async (request, reply) => {
    const query = z
      .object({
        threadId: z.string().min(1),
        invocationId: z.string().min(1),
        callbackToken: z.string().min(1),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      })
      .safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: query.error.message });
    try {
      return {
        messages: ctx.communication.getThreadContextForCallback({
          threadId: query.data.threadId,
          invocationId: query.data.invocationId,
          callbackToken: query.data.callbackToken,
          limit: query.data.limit ?? 100,
        }),
      };
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.post("/api/callbacks/tools/read-file", async (request, reply) => {
    try {
      const body = callbackReadFileSchema.parse(request.body);
      return await ctx.workspaceFiles.readFile(body);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.post("/api/callbacks/tools/read-file-slice", async (request, reply) => {
    try {
      const body = callbackReadFileSliceSchema.parse(request.body);
      return await ctx.workspaceFiles.readFileSlice(body);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.post("/api/callbacks/tools/list-files", async (request, reply) => {
    try {
      const body = callbackListFilesSchema.parse(request.body);
      return await ctx.workspaceFiles.listFiles(body);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.post("/api/callbacks/tools/write-file", async (request, reply) => {
    try {
      const body = callbackWriteFileSchema.parse(request.body);
      return await ctx.workspaceFiles.writeFile(body);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.get("/api/events", async (request, reply) => {
    const requestOrigin = request.headers.origin;
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": requestOrigin ?? "*",
      vary: "origin",
    });
    reply.raw.write("\n");
    const unsubscribe = ctx.events.subscribe((event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    request.raw.on("close", unsubscribe);
  });
}

async function normalizeProjectPathPatch(
  projectPath: string | null | undefined,
  ctx: AppContext,
): Promise<string | null | undefined> {
  if (projectPath === undefined || projectPath === null) return projectPath;
  const result = await validateProjectPathDetailed(projectPath);
  if (!result.ok) throw new Error(result.message ?? `Invalid project path: ${result.reason}`);
  const now = Date.now();
  ctx.stores.workspaceStore.upsert({
    id: nanoid(),
    name: defaultWorkspaceName(result.path),
    projectPath: result.path,
    trustedAt: now,
    lastOpenedAt: now,
    createdAt: now,
  });
  return result.path;
}
