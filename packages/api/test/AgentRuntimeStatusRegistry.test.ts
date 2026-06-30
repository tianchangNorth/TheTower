import assert from "node:assert/strict";
import test from "node:test";
import { AgentRuntimeStatusRegistry } from "../src/agents/AgentRuntimeStatusRegistry.js";

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
      budgetTokens: 200,
      source: "provider",
    },
  });

  assert.equal(status.tokenUsage?.totalTokens, 150);
  assert.equal(status.tokenUsage?.remainingTokens, 50);
  assert.equal(status.status, "idle");
});
