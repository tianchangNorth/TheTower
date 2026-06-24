import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { initSchema } from "../src/db/schema.js";
import { AgentStore } from "../src/stores/AgentStore.js";
import type { Agent } from "../src/types.js";

test("replaceAll removes agents that are no longer in the catalog", () => {
  const db = new Database(":memory:");
  initSchema(db);
  const store = new AgentStore(db);

  store.upsert(makeAgent("agent-a", "@agent-a"));
  store.upsert(makeAgent("agent-b", "@agent-b"));
  store.replaceAll([makeAgent("zavala", "@zavala"), makeAgent("ikora", "@ikora")]);

  assert.deepEqual(
    store.list().map((agent) => agent.id),
    ["zavala", "ikora"],
  );
});

function makeAgent(id: string, handle: string): Agent {
  return {
    id,
    displayName: id,
    mentionHandles: [handle],
    provider: "mock",
    model: `mock-${id}`,
    rolePrompt: id,
    enabled: true,
    createdAt: Date.now(),
  };
}
