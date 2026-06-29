import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { initSchema } from "../src/db/schema.js";
import { WorkspaceStore } from "../src/stores/WorkspaceStore.js";

test("WorkspaceStore upserts and lists by last opened time", () => {
  const db = new Database(":memory:");
  initSchema(db);
  const store = new WorkspaceStore(db);

  store.upsert({
    id: "workspace-1",
    name: "TheTower",
    projectPath: "/Users/xuchenyang/ai/TheTower",
    trustedAt: 1,
    lastOpenedAt: 1,
    createdAt: 1,
  });
  store.upsert({
    id: "workspace-2",
    name: "TheTower renamed",
    projectPath: "/Users/xuchenyang/ai/TheTower",
    trustedAt: 2,
    lastOpenedAt: 3,
    createdAt: 2,
  });

  const workspace = store.getByProjectPath("/Users/xuchenyang/ai/TheTower");
  assert.equal(workspace?.id, "workspace-1");
  assert.equal(workspace?.name, "TheTower renamed");
  assert.equal(workspace?.lastOpenedAt, 3);
  assert.equal(store.list()[0]?.projectPath, "/Users/xuchenyang/ai/TheTower");
});
