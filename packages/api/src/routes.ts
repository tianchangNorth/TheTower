import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AgentRegistry } from "./agents/AgentRegistry.js";
import type { createAppContext } from "./bootstrap.js";

type AppContext = ReturnType<typeof createAppContext>;

const postMessageSchema = z.object({
  threadId: z.string().min(1).optional(),
  content: z.string().min(1),
});

const callbackPostMessageSchema = z.object({
  invocationId: z.string().min(1),
  callbackToken: z.string().min(1),
  agentId: z.string().min(1),
  content: z.string().min(1),
  targetAgents: z.array(z.string().min(1)).optional(),
  replyTo: z.string().min(1).optional(),
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

export async function registerRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  app.get("/health", async () => ({ ok: true }));

  app.get("/api/agents", async () => ({ agents: ctx.agentRegistry.list() }));

  app.patch("/api/agents/:agentId", async (request, reply) => {
    const params = z.object({ agentId: z.string().min(1) }).parse(request.params);
    const body = updateAgentSchema.parse(request.body);
    const existing = ctx.stores.agentStore.get(params.agentId);
    if (!existing) return reply.code(404).send({ error: "agent not found" });

    const updated = { ...existing, ...body };
    const nextAgents = ctx.stores.agentStore
      .list()
      .map((agent) => (agent.id === updated.id ? updated : agent));

    try {
      const validationRegistry = new AgentRegistry();
      validationRegistry.replaceAll(nextAgents);
      ctx.stores.agentStore.upsert(updated);
      ctx.agentRegistry.replaceAll(nextAgents);
      return { agent: updated };
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.get("/api/threads", async () => ({ threads: ctx.stores.threadStore.list() }));

  app.get("/api/threads/:threadId/messages", async (request) => {
    const params = z.object({ threadId: z.string().min(1) }).parse(request.params);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }).parse(request.query);
    return { messages: ctx.stores.messageStore.listByThread(params.threadId, query.limit ?? 100) };
  });

  app.post("/api/messages", async (request, reply) => {
    const body = postMessageSchema.parse(request.body);
    const result = await ctx.communication.postUserMessage(body);
    return reply.code(202).send(result);
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
        limit: z.coerce.number().int().min(1).max(200).optional(),
      })
      .safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: query.error.message });
    return { messages: ctx.communication.getThreadContext(query.data.threadId, query.data.limit ?? 100) };
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
