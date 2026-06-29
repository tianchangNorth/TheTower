import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { initSchema } from "../src/db/schema.js";
import { ThreadStore } from "../src/stores/ThreadStore.js";

test("ThreadStore defaults thread mode to debug", () => {
  const db = new Database(":memory:");
  initSchema(db);
  const store = new ThreadStore(db);

  store.create({
    id: "thread-1",
    title: "Thread",
    createdAt: 1,
    updatedAt: 1,
  });

  assert.equal(store.get("thread-1")?.mode, "debug");
});

test("ThreadStore updates thread mode", () => {
  const db = new Database(":memory:");
  initSchema(db);
  const store = new ThreadStore(db);
  store.create({
    id: "thread-1",
    title: "Thread",
    mode: "debug",
    createdAt: 1,
    updatedAt: 1,
  });

  const updated = store.updateMode("thread-1", "play");

  assert.equal(updated?.mode, "play");
  assert.equal(store.get("thread-1")?.mode, "play");
});

test("ThreadStore stores and updates projectPath", () => {
  const db = new Database(":memory:");
  initSchema(db);
  const store = new ThreadStore(db);
  store.create({
    id: "thread-1",
    title: "Thread",
    mode: "debug",
    projectPath: "/Users/xuchenyang/ai/TheTower",
    createdAt: 1,
    updatedAt: 1,
  });

  assert.equal(store.get("thread-1")?.projectPath, "/Users/xuchenyang/ai/TheTower");

  const updated = store.updateProjectPath("thread-1", "/Users/xuchenyang/ai/cat-cafe-tutorials");
  assert.equal(updated?.projectPath, "/Users/xuchenyang/ai/cat-cafe-tutorials");
});

test("ThreadStore.delete removes the thread and cascades dependents", () => {
  const db = new Database(":memory:");
  initSchema(db);
  const store = new ThreadStore(db);
  store.create({ id: "thread-1", title: "Thread", mode: "debug", createdAt: 1, updatedAt: 1 });
  store.create({ id: "thread-2", title: "Other", mode: "debug", createdAt: 1, updatedAt: 1 });

  db.prepare(
    "INSERT INTO messages (id, thread_id, sender_type, content, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run("msg-1", "thread-1", "user", "hi", 1);
  db.prepare(
    `INSERT INTO invocations (id, thread_id, root_message_id, status, target_agents_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("inv-1", "thread-1", "msg-1", "running", "[]", 1);
  db.prepare(
    "INSERT INTO callback_tokens (invocation_id, token_hash, expires_at, active) VALUES (?, ?, ?, ?)",
  ).run("inv-1", "hash", 1, 1);

  assert.equal(store.delete("thread-1"), true);
  assert.equal(store.get("thread-1"), null);
  assert.equal(store.get("thread-2")?.id, "thread-2");
  assert.equal(
    db.prepare("SELECT COUNT(*) AS c FROM messages WHERE thread_id = ?").get("thread-1").c,
    0,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS c FROM invocations WHERE thread_id = ?").get("thread-1").c,
    0,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS c FROM callback_tokens WHERE invocation_id = ?").get("inv-1").c,
    0,
  );
});

test("ThreadStore.delete returns false for missing thread", () => {
  const db = new Database(":memory:");
  initSchema(db);
  const store = new ThreadStore(db);
  assert.equal(store.delete("nope"), false);
});

test("initSchema migrates legacy threads table with debug mode", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  db.prepare("INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
    "legacy-thread",
    "Legacy",
    1,
    1,
  );

  initSchema(db);

  const store = new ThreadStore(db);
  assert.equal(store.get("legacy-thread")?.mode, "debug");
  assert.equal(store.get("legacy-thread")?.projectPath, undefined);
});
