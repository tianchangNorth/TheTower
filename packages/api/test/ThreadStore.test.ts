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
