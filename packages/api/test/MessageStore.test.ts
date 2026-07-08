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
    thinking: "先确认交接对象。",
    mentions: ["banshee"],
    visibility: "private",
    visibleToAgentIds: ["banshee"],
    revealedAt: 123,
    origin: "callback",
    deliveryStatus: "delivered",
    toolEvents: [{ id: "tool-1", type: "tool_use", label: "mcp__thetower__post_message", detail: "{}", timestamp: 456 }],
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
    extra: {
      isExplicitPost: true,
      stream: {
        invocationId: "invocation-1",
        cliStdout: "stdout",
        speechContent: "speech",
      },
    },
    invocationId: "invocation-1",
    replyTo: "message-0",
    createdAt: 789,
  });

  const message = store.get("message-1");
  assert.equal(message?.visibility, "private");
  assert.equal(message?.thinking, "先确认交接对象。");
  assert.deepEqual(message?.visibleToAgentIds, ["banshee"]);
  assert.equal(message?.revealedAt, 123);
  assert.equal(message?.origin, "callback");
  assert.equal(message?.deliveryStatus, "delivered");
  assert.deepEqual(message?.toolEvents, [
    { id: "tool-1", type: "tool_use", label: "mcp__thetower__post_message", detail: "{}", timestamp: 456 },
  ]);
  assert.equal(message?.handoffPayload?.nextAction, "实现 MessageStore 字段持久化。");
  assert.deepEqual(message?.handoffPayload?.toAgentIds, ["banshee"]);
  assert.deepEqual(message?.extra, {
    isExplicitPost: true,
    stream: {
      invocationId: "invocation-1",
      cliStdout: "stdout",
      speechContent: "speech",
    },
  });
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
  assert.equal(message?.origin, "agent_stream");
  assert.equal(message?.deliveryStatus, "delivered");
  assert.equal(message?.visibleToAgentIds, undefined);
  assert.equal(message?.handoffPayload, undefined);
  assert.equal(message?.extra, undefined);
});

test("MessageStore reveal sets revealedAt and returns the updated message", () => {
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
    content: "private note",
    mentions: [],
    visibility: "private",
    visibleToAgentIds: ["ikora"],
    origin: "callback",
    deliveryStatus: "delivered",
    createdAt: 1,
  });

  const message = store.reveal("message-1", 123);

  assert.equal(message?.revealedAt, 123);
  assert.equal(store.get("message-1")?.revealedAt, 123);
});

test("MessageStore appends thinking deltas without block separators", () => {
  const db = new Database(":memory:");
  initSchema(db);
  db.prepare("INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
    "thread-1",
    "Test thread",
    1,
    1,
  );
  const store = new MessageStore(db);

  const first = store.appendThinkingChunk({
    threadId: "thread-1",
    senderId: "zavala",
    invocationId: "invocation-1",
    content: "first",
    mode: "delta",
    createdAt: 10,
  });
  const second = store.appendThinkingChunk({
    threadId: "thread-1",
    senderId: "zavala",
    invocationId: "invocation-1",
    content: "second",
    mode: "delta",
    createdAt: 11,
  });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.message.id, first.message.id);
  assert.equal(second.message.content, "");
  assert.equal(second.message.thinking, "firstsecond");
  assert.equal(second.message.extra?.stream?.chunkType, "thinking");
  assert.equal(store.listByThread("thread-1", 100).filter((message) => message.origin === "agent_stream").length, 1);
});

test("MessageStore keeps stream stdout and tool events on one stream message", () => {
  const db = new Database(":memory:");
  initSchema(db);
  db.prepare("INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
    "thread-1",
    "Test thread",
    1,
    1,
  );
  const store = new MessageStore(db);

  const tool = store.appendToolEvent({
    threadId: "thread-1",
    senderId: "zavala",
    invocationId: "invocation-1",
    event: { id: "tool-1", type: "tool_use", label: "mcp__thetower__post_message", detail: "{}", timestamp: 10 },
    createdAt: 10,
  });
  const stdout = store.appendStreamText({
    threadId: "thread-1",
    senderId: "zavala",
    invocationId: "invocation-1",
    content: "posted callback",
    createdAt: 11,
  });

  assert.equal(tool.created, true);
  assert.equal(stdout.created, false);
  assert.equal(stdout.message.id, tool.message.id);
  assert.equal(stdout.message.content, "posted callback");
  assert.equal(stdout.message.extra?.stream?.cliStdout, "posted callback");
  assert.deepEqual(stdout.message.toolEvents?.map((event) => event.label), ["mcp__thetower__post_message"]);
});

test("MessageStore listByThread limit counts non-stream messages only", () => {
  const db = new Database(":memory:");
  initSchema(db);
  db.prepare("INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
    "thread-1",
    "Test thread",
    1,
    1,
  );
  const store = new MessageStore(db);

  for (let i = 1; i <= 3; i += 1) {
    store.create({
      id: `user-${i}`,
      threadId: "thread-1",
      senderType: "user",
      content: `user ${i}`,
      mentions: [],
      origin: "user",
      createdAt: i * 10,
    });
  }
  for (let i = 1; i <= 5; i += 1) {
    store.create({
      id: `stream-${i}`,
      threadId: "thread-1",
      senderType: "agent",
      senderId: "zavala",
      content: `stream ${i}`,
      mentions: [],
      origin: "agent_stream",
      invocationId: `invocation-${i}`,
      extra: { stream: { invocationId: `invocation-${i}`, chunkType: "text" } },
      createdAt: 25 + i,
    });
  }

  const messages = store.listByThread("thread-1", 2);

  assert.deepEqual(
    messages.filter((message) => message.origin !== "agent_stream").map((message) => message.id),
    ["user-2", "user-3"],
  );
  assert.equal(messages.filter((message) => message.origin === "agent_stream").length, 5);
});
