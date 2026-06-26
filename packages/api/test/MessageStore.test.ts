import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { initSchema } from "../src/db/schema.js";
import { MessageStore } from "../src/stores/MessageStore.js";

test("MessageStore round-trips Phase 2 message visibility fields", () => {
  const db = new Database(":memory:");
  initSchema(db);
  db.prepare("INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
    "thread-1",
    "Test thread",
    1,
    1,
  );
  const store = new MessageStore(db);

  store.create({
    id: "message-1",
    threadId: "thread-1",
    senderType: "agent",
    senderId: "ikora",
    content: "@banshee 请继续。",
    mentions: ["banshee"],
    visibility: "private",
    visibleToAgentIds: ["banshee"],
    revealedAt: 123,
    origin: "callback",
    deliveryStatus: "delivered",
    handoffPayload: {
      fromAgentId: "ikora",
      toAgentIds: ["banshee"],
      triggerMessageId: "message-0",
      what: "已完成分析。",
      why: "需要 Banshee 继续实现。",
      tradeoff: "先保持最小实现。",
      openQuestions: ["是否需要 UI 展开？"],
      nextAction: "实现 MessageStore 字段持久化。",
      evidenceRefs: [{ kind: "message", ref: "message-0", note: "用户要求" }],
      riskLevel: "low",
      createdAt: 456,
    },
    invocationId: "invocation-1",
    replyTo: "message-0",
    createdAt: 789,
  });

  const message = store.get("message-1");
  assert.equal(message?.visibility, "private");
  assert.deepEqual(message?.visibleToAgentIds, ["banshee"]);
  assert.equal(message?.revealedAt, 123);
  assert.equal(message?.origin, "callback");
  assert.equal(message?.deliveryStatus, "delivered");
  assert.equal(message?.handoffPayload?.nextAction, "实现 MessageStore 字段持久化。");
  assert.deepEqual(message?.handoffPayload?.toAgentIds, ["banshee"]);
});

test("initSchema migrates legacy messages table and MessageStore applies defaults", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      sender_id TEXT,
      content TEXT NOT NULL,
      mentions_json TEXT NOT NULL DEFAULT '[]',
      invocation_id TEXT,
      reply_to TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  db.prepare(
    `
    INSERT INTO messages (
      id, thread_id, sender_type, sender_id, content, mentions_json, invocation_id, reply_to, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run("legacy-1", "thread-1", "agent", "zavala", "legacy content", "[]", null, null, 1);

  initSchema(db);

  const store = new MessageStore(db);
  const message = store.get("legacy-1");
  assert.equal(message?.visibility, "public");
  assert.equal(message?.origin, "agent_final");
  assert.equal(message?.deliveryStatus, "delivered");
  assert.equal(message?.visibleToAgentIds, undefined);
  assert.equal(message?.handoffPayload, undefined);
});
