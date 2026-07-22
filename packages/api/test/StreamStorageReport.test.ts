import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { initSchema } from "../src/db/schema.js";
import { observeStreamStorage } from "../src/observability/StreamStorageReport.js";
import { MessageStore } from "../src/stores/MessageStore.js";

test("stream storage stays at one row per invocation and agent under sustained chunks", () => {
  const db = new Database(":memory:");
  try {
    initSchema(db);
    db.prepare("INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
      "thread-1",
      "Stream volume fixture",
      1,
      1,
    );
    const store = new MessageStore(db);
    for (let i = 0; i < 250; i += 1) {
      store.appendStreamText({
        threadId: "thread-1",
        invocationId: "invocation-1",
        senderId: "zavala",
        content: `chunk-${i.toString().padStart(3, "0")}`,
        createdAt: i + 1,
      });
    }
    for (let i = 0; i < 50; i += 1) {
      store.appendThinkingChunk({
        threadId: "thread-1",
        invocationId: "invocation-1",
        senderId: "zavala",
        content: "thought",
        mode: "delta",
        createdAt: i + 300,
      });
    }

    const report = observeStreamStorage(db);
    assert.equal(report.summary.streamRows, 1);
    assert.equal(report.summary.invocationAgentGroups, 1);
    assert.equal(report.summary.maxRowsPerGroup, 1);
    const expectedStdout = Array.from({ length: 250 }, (_, i) => `chunk-${i.toString().padStart(3, "0")}`).join("\n");
    assert.equal(report.groups[0]?.contentBytes, Buffer.byteLength(expectedStdout));
    assert.equal(report.groups[0]?.thinkingBytes, 50 * Buffer.byteLength("thought"));
    assert.deepEqual(report.breaches, []);
  } finally {
    db.close();
  }
});

test("stream storage report flags historical duplicate rows and configurable payload budgets", () => {
  const db = new Database(":memory:");
  try {
    initSchema(db);
    db.prepare("INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run("thread-1", "T", 1, 1);
    const store = new MessageStore(db);
    for (const id of ["stream-1", "stream-2"]) {
      store.create({
        id,
        threadId: "thread-1",
        senderType: "agent",
        senderId: "zavala",
        content: "payload",
        mentions: [],
        origin: "agent_stream",
        invocationId: "invocation-1",
        createdAt: id === "stream-1" ? 1 : 2,
      });
    }

    const report = observeStreamStorage(db, { maxPayloadBytesPerInvocationAgent: 5 });
    assert.equal(report.summary.maxRowsPerGroup, 2);
    assert.deepEqual(report.breaches.map((breach) => breach.kind).sort(), ["payload_bytes", "row_count"]);
  } finally {
    db.close();
  }
});
