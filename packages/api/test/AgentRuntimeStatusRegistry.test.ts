import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { AgentRuntimeStatusRegistry } from "../src/agents/AgentRuntimeStatusRegistry.js";
import { initSchema } from "../src/db/schema.js";
import { AgentRuntimeStatusStore } from "../src/stores/AgentRuntimeStatusStore.js";

test("AgentRuntimeStatusRegistry stores status snapshots by agent and thread", () => {
  const registry = new AgentRuntimeStatusRegistry();

  const thinking = registry.markSessionStarted({
    agentId: "zavala",
    threadId: "thread-1",
    invocationId: "invocation-1",
    startedAt: 100,
  });
  assert.equal(thinking.status, "thinking");
  assert.equal(thinking.startedAt, 100);

  const tool = registry.setStatus({
    agentId: "zavala",
    threadId: "thread-1",
    invocationId: "invocation-1",
    status: "tool_calling",
    currentToolName: "read_file",
  });
  assert.equal(tool.currentToolName, "read_file");
  assert.equal(tool.status, "tool_calling");

  assert.deepEqual(registry.listByThread("thread-1").map((status) => status.agentId), ["zavala"]);
  assert.deepEqual(registry.listByThread("thread-2"), []);
});

test("AgentRuntimeStatusRegistry normalizes token totals and remaining budget", () => {
  const registry = new AgentRuntimeStatusRegistry();

  const status = registry.setTokenUsage({
    agentId: "ikora",
    threadId: "thread-1",
    invocationId: "invocation-1",
    usage: {
      inputTokens: 120,
      outputTokens: 30,
      contextWindowSize: 200,
      contextUsedTokens: 120,
      budgetTokens: 200,
      source: "provider",
    },
  });

  assert.equal(status.tokenUsage?.totalTokens, 150);
  assert.equal(status.tokenUsage?.remainingTokens, 80);
  assert.equal(status.status, "idle");
});

test("AgentRuntimeStatusRegistry aggregates usage counters but keeps latest context snapshot", () => {
  const registry = new AgentRuntimeStatusRegistry();

  registry.setTokenUsage({
    agentId: "zavala",
    threadId: "thread-1",
    invocationId: "invocation-1",
    usage: {
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 40,
      contextWindowSize: 1_000,
      contextUsedTokens: 100,
      source: "provider",
    },
  });
  const status = registry.setTokenUsage({
    agentId: "zavala",
    threadId: "thread-1",
    invocationId: "invocation-1",
    usage: {
      inputTokens: 50,
      outputTokens: 10,
      contextWindowSize: 2_000,
      contextUsedTokens: 50,
      budgetTokens: 2_000,
      source: "provider",
    },
  });

  assert.equal(status.tokenUsage?.inputTokens, 150);
  assert.equal(status.tokenUsage?.outputTokens, 30);
  assert.equal(status.tokenUsage?.cacheReadTokens, 40);
  assert.equal(status.tokenUsage?.contextWindowSize, 2_000);
  assert.equal(status.tokenUsage?.contextUsedTokens, 50);
  assert.equal(status.tokenUsage?.remainingTokens, 1_950);
});

test("AgentRuntimeStatusRegistry does not treat cumulative provider input as context fill", () => {
  const registry = new AgentRuntimeStatusRegistry();

  const status = registry.setTokenUsage({
    agentId: "ikora",
    threadId: "thread-1",
    invocationId: "invocation-1",
    usage: {
      inputTokens: 407_700,
      outputTokens: 900,
      contextWindowSize: 200_000,
      budgetTokens: 200_000,
      isCumulativeUsage: true,
      source: "provider",
    },
  });

  assert.equal(status.tokenUsage?.totalTokens, 408_600);
  assert.equal(status.tokenUsage?.remainingTokens, undefined);
});

test("AgentRuntimeStatusRegistry clears previous usage when a new session starts", () => {
  const registry = new AgentRuntimeStatusRegistry();

  registry.setTokenUsage({
    agentId: "zavala",
    threadId: "thread-1",
    invocationId: "invocation-1",
    usage: { inputTokens: 100, outputTokens: 20, source: "provider" },
  });
  const status = registry.markSessionStarted({
    agentId: "zavala",
    threadId: "thread-1",
    invocationId: "invocation-2",
  });

  assert.equal(status.tokenUsage, undefined);
  assert.equal(status.invocationId, "invocation-2");
});

test("AgentRuntimeStatusRegistry persists and hydrates snapshots", () => {
  const db = new Database(":memory:");
  initSchema(db);
  db.prepare("INSERT INTO threads (id, title, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
    "thread-1",
    "Thread",
    "play",
    1,
    1,
  );
  const store = new AgentRuntimeStatusStore(db);
  const registry = new AgentRuntimeStatusRegistry(store);

  registry.setTokenUsage({
    agentId: "zavala",
    threadId: "thread-1",
    invocationId: "invocation-1",
    usage: {
      inputTokens: 300,
      outputTokens: 20,
      contextUsedTokens: 300,
      contextWindowSize: 2_000,
      budgetTokens: 2_000,
      source: "provider",
    },
  });

  const hydrated = new AgentRuntimeStatusRegistry(store);
  const status = hydrated.get("zavala");
  assert.equal(status?.threadId, "thread-1");
  assert.equal(status?.tokenUsage?.contextUsedTokens, 300);
  assert.equal(status?.tokenUsage?.remainingTokens, 1_700);
});
