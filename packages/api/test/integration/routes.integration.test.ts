import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { buildApp } from "../../src/app.js";
import { createAppContext } from "../../src/bootstrap.js";
import { formatSseEvent } from "../../src/routes.js";
import type { Agent } from "../../src/types.js";

const agents: Agent[] = [
  {
    id: "zavala",
    displayName: "Zavala",
    mentionHandles: ["@zavala"],
    provider: "mock",
    model: "mock",
    enabled: true,
    persona: { roleDescription: "Coordinator", personality: "Calm", strengths: [], restrictions: [] },
    createdAt: 1,
  },
  {
    id: "unsupported",
    displayName: "Unsupported",
    mentionHandles: ["@unsupported"],
    provider: "gemini",
    model: "gemini",
    enabled: true,
    persona: { roleDescription: "Unavailable", personality: "Calm", strengths: [], restrictions: [] },
    createdAt: 1,
  },
];

async function withApp(run: (ctx: ReturnType<typeof createAppContext>, app: Awaited<ReturnType<typeof buildApp>>) => Promise<void>) {
  const database = new Database(":memory:");
  const ctx = createAppContext({ database, agents, projectRoot: process.cwd() });
  const app = await buildApp(ctx, false);
  try {
    await run(ctx, app);
  } finally {
    await app.close();
    database.close();
  }
}

test("POST /api/messages accepts supported modes and rejects unavailable capabilities", async () => {
  await withApp(async (_ctx, app) => {
    const accepted = await app.inject({
      method: "POST",
      url: "/api/messages",
      payload: { content: "Hello @zavala", targetAgents: ["zavala"], routeMode: "single" },
    });
    assert.equal(accepted.statusCode, 202);

    const unsupportedMode = await app.inject({
      method: "POST",
      url: "/api/messages",
      payload: { content: "Hello @zavala", targetAgents: ["zavala"], routeMode: "fanout" },
    });
    assert.equal(unsupportedMode.statusCode, 422);
    assert.equal(unsupportedMode.json().code, "unsupported_route_mode");

    const unsupportedProvider = await app.inject({
      method: "POST",
      url: "/api/messages",
      payload: { content: "Hello @unsupported", targetAgents: ["unsupported"] },
    });
    assert.equal(unsupportedProvider.statusCode, 422);
    assert.equal(unsupportedProvider.json().code, "unsupported_agent_provider");
  });
});

test("callback authentication, cancellation, and thread deletion are enforced through routes", async () => {
  await withApp(async (ctx, app) => {
    const now = Date.now();
    ctx.stores.threadStore.create({ id: "thread-1", title: "Thread", mode: "play", createdAt: now, updatedAt: now });
    ctx.stores.messageStore.create({
      id: "root-1", threadId: "thread-1", senderType: "user", content: "root", mentions: [], createdAt: now,
    });
    ctx.stores.invocationStore.create({
      id: "invocation-1", threadId: "thread-1", rootMessageId: "root-1", status: "running", targetAgents: ["zavala"], routeMode: "single", depth: 0, createdAt: now,
    });
    ctx.stores.callbackTokenStore.create({
      invocationId: "invocation-1", token: "valid-token", agentId: "zavala", stepId: "step-1", expiresAt: now + 60_000,
    });
    const abortController = new AbortController();
    // Registering the live worklist makes cancellation observable without starting a runner.
    ctx.worklists.register({
      invocationId: "invocation-1", threadId: "thread-1", targetAgents: ["zavala"], routeMode: "single", maxDepth: 3, abortController,
    });

    const denied = await app.inject({
      method: "POST", url: "/api/callbacks/post-message",
      headers: { authorization: "Bearer wrong" },
      payload: { invocationId: "invocation-1", agentId: "zavala", content: "Nope" },
    });
    assert.equal(denied.statusCode, 400);

    const impersonation = await app.inject({
      method: "POST", url: "/api/callbacks/post-message",
      headers: { authorization: "Bearer valid-token" },
      payload: { invocationId: "invocation-1", agentId: "unsupported", content: "Forged" },
    });
    assert.equal(impersonation.statusCode, 400);
    assert.equal(ctx.stores.messageStore.listByThread("thread-1").some((message) => message.content === "Forged"), false);

    const callback = await app.inject({
      method: "POST", url: "/api/callbacks/post-message",
      headers: { authorization: "Bearer valid-token" },
      payload: { invocationId: "invocation-1", agentId: "zavala", content: "Done" },
    });
    assert.equal(callback.statusCode, 200);

    const activeDelete = await app.inject({ method: "DELETE", url: "/api/threads/thread-1" });
    assert.equal(activeDelete.statusCode, 409);

    const cancelled = await app.inject({ method: "POST", url: "/api/threads/thread-1/invocations/invocation-1/cancel" });
    assert.equal(cancelled.statusCode, 200);
    assert.equal(abortController.signal.aborted, true);
    assert.equal(ctx.stores.invocationStore.get("invocation-1")?.status, "cancelled");

    ctx.stores.threadStore.create({ id: "thread-delete", title: "Delete", mode: "play", createdAt: now, updatedAt: now });
    const deleted = await app.inject({ method: "DELETE", url: "/api/threads/thread-delete" });
    assert.equal(deleted.statusCode, 200);
    assert.equal(ctx.stores.threadStore.get("thread-delete"), null);
  });
});

test("SSE events use a complete data frame", () => {
  assert.equal(formatSseEvent({ type: "message.created", threadId: "thread-1", messageId: "message-1" }),
    'data: {"type":"message.created","threadId":"thread-1","messageId":"message-1"}\n\n');
});
