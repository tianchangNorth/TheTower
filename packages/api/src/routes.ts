import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import { AgentRegistry } from "./agents/AgentRegistry.js";
import type { createAppContext } from "./bootstrap.js";
import { normalizeAgentModel, personaSchema, updateAgentInCatalog } from "./config/AgentConfigLoader.js";
import { defaultWorkspaceName, validateProjectPathDetailed } from "./workspaces/projectPath.js";
import type {
  Invocation,
  InvocationStatus,
  Message,
  ServerEvent,
  TelemetryContextRecentMessage,
  TelemetryEventEntry,
  TelemetryThreadSummary,
  ThreadTelemetryContextResponse,
  ToolAuditRow,
} from "./types.js";

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
    persona: personaSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "at least one field is required");

const updateThreadSchema = z
  .object({
    mode: z.enum(["debug", "play"]).optional(),
    projectPath: z.string().min(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "at least one field is required");

const agentParamsSchema = z.object({ agentId: z.string().min(1) });

class AgentNotFoundError extends Error {
  constructor(message = "agent not found") {
    super(message);
    this.name = "AgentNotFoundError";
  }
}

/** 校验并持久化 Agent 配置更新（catalog + store + registry）。 */
async function applyAgentUpdate(ctx: AppContext, agentId: string, body: unknown) {
  const parsed = updateAgentSchema.parse(body);
  const existing = ctx.stores.agentStore.get(agentId);
  if (!existing) throw new AgentNotFoundError();
  const updated = { ...existing, ...parsed };
  updated.model = normalizeAgentModel(updated.provider, updated.model);
  const nextAgents = ctx.stores.agentStore.list().map((agent) => (agent.id === updated.id ? updated : agent));
  const validationRegistry = new AgentRegistry();
  validationRegistry.replaceAll(nextAgents);
  updateAgentInCatalog(updated, ctx.projectRoot);
  ctx.stores.agentStore.upsert(updated);
  ctx.agentRegistry.replaceAll(nextAgents);
  return updated;
}

// ============ Telemetry 辅助（Phase 4）============

function telemetryWorkspaceLabel(projectPath?: string): string | undefined {
  if (!projectPath) return undefined;
  const parts = projectPath.split("/").filter(Boolean);
  return parts.at(-1) ?? projectPath;
}

function eventCreatedAt(event: ServerEvent): number | undefined {
  if ("createdAt" in event) return event.createdAt;
  return undefined;
}

function computeLastEventAt(events: TelemetryEventEntry[], threadId: string): number | undefined {
  let latest: number | undefined;
  for (const { event } of events) {
    if ("threadId" in event && event.threadId === threadId) {
      const t = eventCreatedAt(event);
      if (t !== undefined && (latest === undefined || t > latest)) latest = t;
    }
  }
  return latest;
}

interface EventQuery {
  threadId?: string;
  invocationId?: string;
  agentId?: string;
  type?: string;
  from?: number;
  to?: number;
  limit?: number;
}

function queryEventEntries(ctx: AppContext, filter: EventQuery): TelemetryEventEntry[] {
  const limit = filter.limit ?? 200;
  const filtered = ctx.events.recent().filter(({ event }) => {
    if (filter.threadId && (!("threadId" in event) || event.threadId !== filter.threadId)) return false;
    if (filter.invocationId && (!("invocationId" in event) || event.invocationId !== filter.invocationId))
      return false;
    if (filter.agentId && (!("agentId" in event) || event.agentId !== filter.agentId)) return false;
    if (filter.type && event.type !== filter.type) return false;
    if (filter.from !== undefined) {
      const t = eventCreatedAt(event);
      if (t === undefined || t < filter.from) return false;
    }
    if (filter.to !== undefined) {
      const t = eventCreatedAt(event);
      if (t === undefined || t > filter.to) return false;
    }
    return true;
  });
  return filtered.slice(-limit).reverse();
}

function queryToolAudit(ctx: AppContext, filter: EventQuery): ToolAuditRow[] {
  const entries = queryEventEntries(ctx, { ...filter, type: "workspace.file_tool" });
  return entries.map(({ seq, event }) => {
    const e = event as Extract<ServerEvent, { type: "workspace.file_tool" }>;
    return {
      seq,
      threadId: e.threadId,
      invocationId: e.invocationId,
      agentId: e.agentId,
      tool: e.tool,
      path: e.path,
      bytes: e.bytes,
      denied: e.denied,
      reason: e.reason,
      createdAt: e.createdAt,
    };
  });
}

function buildTelemetryThreads(ctx: AppContext): TelemetryThreadSummary[] {
  const threads = ctx.stores.threadStore.list();
  const recentEvents = ctx.events.recent();
  return threads.map((thread) => {
    const invocations = ctx.stores.invocationStore.listByThread(thread.id, 50);
    const messages = ctx.stores.messageStore.listByThread(thread.id, 200);
    const errorCount = invocations.filter((i) => i.status === "failed").length;
    const activeAgentIds = ctx.runtimeStatuses.listByThread(thread.id).map((s) => s.agentId);
    return {
      thread,
      workspaceLabel: telemetryWorkspaceLabel(thread.projectPath),
      projectPath: thread.projectPath,
      activeAgentIds,
      latestInvocation: invocations[0],
      messageCount: messages.length,
      errorCount,
      lastEventAt: computeLastEventAt(recentEvents, thread.id),
    };
  });
}

function summarizeContent(content: string): string {
  const t = content.trim().replace(/\s+/g, " ");
  return t.length > 80 ? `${t.slice(0, 80)}…` : t;
}

function computeStaleReason(
  latest: Invocation | undefined,
  activeAgentIds: string[],
): string | undefined {
  if (!latest) return "no_invocation";
  if (latest.status === "failed") return "invocation_failed";
  if (latest.status === "running" && activeAgentIds.length === 0) return "running_but_no_active_agent";
  return undefined;
}

function buildThreadContext(
  ctx: AppContext,
  threadId: string,
): ThreadTelemetryContextResponse | null {
  const thread = ctx.stores.threadStore.get(threadId);
  if (!thread) return null;
  const messages = ctx.stores.messageStore.listByThread(threadId, 200);
  const invocations = ctx.stores.invocationStore.listByThread(threadId, 50);
  const latest = invocations[0];
  const activeAgentIds = ctx.runtimeStatuses.listByThread(threadId).map((s) => s.agentId);

  const counts = { total: messages.length, public: 0, private: 0, revealed: 0, handoff: 0 };
  const privateByAgent: Record<string, number> = {};
  for (const m of messages) {
    const vis = m.visibility ?? "public";
    if (vis === "public") counts.public += 1;
    else counts.private += 1;
    if (m.revealedAt) counts.revealed += 1;
    if (m.handoffPayload) counts.handoff += 1;
    if (vis === "private" && m.visibleToAgentIds) {
      for (const aid of m.visibleToAgentIds) privateByAgent[aid] = (privateByAgent[aid] ?? 0) + 1;
    }
  }

  const recentMessages: TelemetryContextRecentMessage[] = messages
    .slice(-10)
    .reverse()
    .map((m: Message) => ({
      id: m.id,
      senderType: m.senderType,
      senderId: m.senderId,
      visibility: m.visibility,
      origin: m.origin,
      revealedAt: m.revealedAt,
      hasHandoff: Boolean(m.handoffPayload),
      createdAt: m.createdAt,
      summary: summarizeContent(m.content),
    }));

  return {
    thread,
    workspaceLabel: telemetryWorkspaceLabel(thread.projectPath),
    projectPath: thread.projectPath,
    workspaceFingerprint: null,
    messageCounts: counts,
    recentMessages,
    latestInvocation: latest,
    activeAgentIds,
    privateVisibility: Object.entries(privateByAgent).map(([agentId, privateCount]) => ({
      agentId,
      privateCount,
    })),
    recentFileToolAccess: queryToolAudit(ctx, { threadId, limit: 10 }),
    staleReason: computeStaleReason(latest, activeAgentIds),
    estimatedTokens: null,
    note: "workspaceFingerprint / estimatedTokens 将在后续 phase 落地。",
  };
}

export async function registerRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  app.get("/health", async () => ({ ok: true }));

  app.get("/api/agents", async () => ({ agents: ctx.agentRegistry.list() }));

  app.get("/api/agents/runtime-status", async () => ({ statuses: ctx.runtimeStatuses.list() }));

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
    const { agentId } = agentParamsSchema.parse(request.params);
    try {
      const agent = await applyAgentUpdate(ctx, agentId, request.body);
      return { agent };
    } catch (err) {
      if (err instanceof AgentNotFoundError) return reply.code(404).send({ error: err.message });
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.get("/api/agents/:agentId/config", async (request, reply) => {
    const { agentId } = agentParamsSchema.parse(request.params);
    const agent = ctx.stores.agentStore.get(agentId);
    if (!agent) return reply.code(404).send({ error: "agent not found" });
    return { agent };
  });

  app.patch("/api/agents/:agentId/config", async (request, reply) => {
    const { agentId } = agentParamsSchema.parse(request.params);
    try {
      const agent = await applyAgentUpdate(ctx, agentId, request.body);
      return { agent };
    } catch (err) {
      if (err instanceof AgentNotFoundError) return reply.code(404).send({ error: err.message });
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.get("/api/agents/:agentId/tools", async (request, reply) => {
    const { agentId } = agentParamsSchema.parse(request.params);
    if (!ctx.stores.agentStore.get(agentId)) return reply.code(404).send({ error: "agent not found" });
    return {
      enabledTools: [],
      mcpServers: [],
      note: "Agent 工具权限矩阵将在后续 phase 落地。",
    };
  });

  app.patch("/api/agents/:agentId/tools", async (_request, reply) => {
    return reply.code(501).send({ error: "agent tools config not yet implemented" });
  });

  app.get("/api/agents/:agentId/runtime", async (request, reply) => {
    const { agentId } = agentParamsSchema.parse(request.params);
    if (!ctx.stores.agentStore.get(agentId)) return reply.code(404).send({ error: "agent not found" });
    return {
      sandbox: null,
      approval: null,
      timeoutMs: null,
      tokenBudget: null,
      concurrency: null,
      note: "运行策略（sandbox/approval/timeout/budget/concurrency）将在后续 phase 落地。",
    };
  });

  app.patch("/api/agents/:agentId/runtime", async (_request, reply) => {
    return reply.code(501).send({ error: "agent runtime config not yet implemented" });
  });

  app.get("/api/agents/:agentId/audit", async (request, reply) => {
    const { agentId } = agentParamsSchema.parse(request.params);
    if (!ctx.stores.agentStore.get(agentId)) return reply.code(404).send({ error: "agent not found" });
    return {
      recentErrors: [],
      configChanges: [],
      note: "配置变更与最近错误审计将在后续 phase 落地。",
    };
  });

  app.get("/api/telemetry/threads", async () => ({ threads: buildTelemetryThreads(ctx) }));

  app.get("/api/invocations", async (request) => {
    const q = (request.query ?? {}) as Record<string, string | undefined>;
    return {
      invocations: ctx.stores.invocationStore.list({
        threadId: q.threadId,
        agentId: q.agentId,
        status: q.status ? (q.status as InvocationStatus) : undefined,
        from: q.from !== undefined ? Number(q.from) : undefined,
        to: q.to !== undefined ? Number(q.to) : undefined,
        limit: q.limit !== undefined ? Number(q.limit) : undefined,
      }),
    };
  });

  // 注：查询端点用 /api/telemetry/events，与 SSE /api/events 分离，避免与流式端点冲突。
  app.get("/api/telemetry/events", async (request) => {
    const q = (request.query ?? {}) as Record<string, string | undefined>;
    return {
      events: queryEventEntries(ctx, {
        threadId: q.threadId,
        invocationId: q.invocationId,
        agentId: q.agentId,
        type: q.type,
        from: q.from !== undefined ? Number(q.from) : undefined,
        to: q.to !== undefined ? Number(q.to) : undefined,
        limit: q.limit !== undefined ? Number(q.limit) : undefined,
      }),
      capability: "live_only" as const,
      note: "进程内 ring buffer，重启后清空；事件持久化在后续 phase 落地。",
    };
  });

  app.get("/api/telemetry/tool-audit", async (request) => {
    const q = (request.query ?? {}) as Record<string, string | undefined>;
    return {
      rows: queryToolAudit(ctx, {
        threadId: q.threadId,
        agentId: q.agentId,
        from: q.from !== undefined ? Number(q.from) : undefined,
        to: q.to !== undefined ? Number(q.to) : undefined,
        limit: q.limit !== undefined ? Number(q.limit) : undefined,
      }),
      capability: "live_only" as const,
      note: "源自事件 ring buffer 的 workspace.file_tool 事件；持久化在后续 phase 落地。",
    };
  });

  app.get("/api/threads/:threadId/context", async (request, reply) => {
    const { threadId } = z.object({ threadId: z.string().min(1) }).parse(request.params);
    const context = buildThreadContext(ctx, threadId);
    if (!context) return reply.code(404).send({ error: "thread not found" });
    return context;
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

  app.get("/api/threads/:threadId/agent-status", async (request) => {
    const params = z.object({ threadId: z.string().min(1) }).parse(request.params);
    return { statuses: ctx.runtimeStatuses.listByThread(params.threadId) };
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
