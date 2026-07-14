import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { initSchema } from "../src/db/schema.js";
import { OperationContextService } from "../src/services/OperationContextService.js";
import { CallbackTokenStore } from "../src/stores/CallbackTokenStore.js";
import { InvocationStore } from "../src/stores/InvocationStore.js";
import { MessageStore } from "../src/stores/MessageStore.js";
import { ThreadStore } from "../src/stores/ThreadStore.js";

test("OperationContext derives caller identity from callback grant", () => {
  const { service } = makeFixture();

  const context = service.resolveCallback({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    carrier: "mcp",
    capabilities: ["message:write"],
  });

  assert.deepEqual(context, {
    caller: { type: "agent", agentId: "zavala" },
    threadId: "thread-1",
    invocationId: "invocation-1",
    stepId: "step-1",
    carrier: "mcp",
    capabilities: ["message:write"],
    trustLevel: "callback_grant",
  });
});

test("OperationContext rejects an agent identity that conflicts with callback grant", () => {
  const { service } = makeFixture();

  assert.throws(
    () =>
      service.resolveCallback({
        invocationId: "invocation-1",
        callbackToken: "token-1",
        carrier: "http_callback",
        capabilities: ["workspace:write"],
        claimedAgentId: "ikora",
      }),
    /agent identity does not match authorization grant/,
  );
});

function makeFixture(): { service: OperationContextService } {
  const db = new Database(":memory:");
  initSchema(db);
  const threadStore = new ThreadStore(db);
  const messageStore = new MessageStore(db);
  const invocationStore = new InvocationStore(db);
  const callbackTokenStore = new CallbackTokenStore(db);
  threadStore.create({ id: "thread-1", title: "Thread", mode: "play", createdAt: 1, updatedAt: 1 });
  messageStore.create({
    id: "root-1",
    threadId: "thread-1",
    senderType: "user",
    content: "root",
    mentions: [],
    createdAt: 1,
  });
  invocationStore.create({
    id: "invocation-1",
    threadId: "thread-1",
    rootMessageId: "root-1",
    status: "running",
    targetAgents: ["zavala"],
    depth: 0,
    createdAt: 1,
  });
  callbackTokenStore.create({
    invocationId: "invocation-1",
    token: "token-1",
    agentId: "zavala",
    stepId: "step-1",
    expiresAt: Date.now() + 60_000,
  });
  return { service: new OperationContextService({ invocationStore, callbackTokenStore }) };
}
