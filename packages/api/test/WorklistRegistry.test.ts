import assert from "node:assert/strict";
import test from "node:test";
import { WorklistRegistry } from "../src/routing/WorklistRegistry.js";

function createRegistry(targetAgents = ["agent-a", "agent-b"], maxDepth = 10): WorklistRegistry {
  const registry = new WorklistRegistry();
  registry.register({
    invocationId: "invocation-1",
    threadId: "thread-1",
    targetAgents,
    maxDepth,
    abortController: new AbortController(),
  });
  return registry;
}

test("push appends a newly mentioned agent to the pending worklist", () => {
  const registry = createRegistry();

  const result = registry.push({
    invocationId: "invocation-1",
    callerAgentId: "agent-a",
    targetAgents: ["agent-c"],
    triggerMessageId: "message-1",
  });

  assert.deepEqual(result, { ok: true, added: ["agent-c"] });
  assert.deepEqual(registry.get("invocation-1")?.list, ["agent-a", "agent-b", "agent-c"]);
  assert.equal(registry.get("invocation-1")?.a2aFrom["agent-c"], "agent-a");
  assert.equal(registry.get("invocation-1")?.triggerMessageId["agent-c"], "message-1");
});

test("push rejects callbacks from an agent that is not currently running", () => {
  const registry = createRegistry();

  const result = registry.push({
    invocationId: "invocation-1",
    callerAgentId: "agent-b",
    targetAgents: ["agent-c"],
  });

  assert.deepEqual(result, { ok: false, added: [], reason: "caller_mismatch" });
  assert.deepEqual(registry.get("invocation-1")?.list, ["agent-a", "agent-b"]);
});

test("push deduplicates agents already pending in the current invocation", () => {
  const registry = createRegistry();

  const result = registry.push({
    invocationId: "invocation-1",
    callerAgentId: "agent-a",
    targetAgents: ["agent-b"],
  });

  assert.deepEqual(result, { ok: false, added: [], reason: "duplicate" });
  assert.deepEqual(registry.get("invocation-1")?.list, ["agent-a", "agent-b"]);
});

test("push ignores self-mentions from the currently running agent", () => {
  const registry = createRegistry(["agent-a"], 10);

  const result = registry.push({
    invocationId: "invocation-1",
    callerAgentId: "agent-a",
    targetAgents: ["agent-a"],
  });

  assert.deepEqual(result, { ok: false, added: [], reason: "duplicate" });
  assert.deepEqual(registry.get("invocation-1")?.list, ["agent-a"]);
});

test("push allows re-enqueueing an already executed agent as a finalizer", () => {
  const registry = createRegistry(["agent-a", "agent-b"], 10);
  const entry = registry.get("invocation-1");
  assert.ok(entry);
  entry.currentIndex = 1;

  const result = registry.push({
    invocationId: "invocation-1",
    callerAgentId: "agent-b",
    targetAgents: ["agent-a"],
  });

  assert.deepEqual(result, { ok: true, added: ["agent-a"] });
  assert.deepEqual(entry.list, ["agent-a", "agent-b", "agent-a"]);
});

test("push enforces max A2A depth", () => {
  const registry = createRegistry(["agent-a"], 1);

  assert.deepEqual(
    registry.push({
      invocationId: "invocation-1",
      callerAgentId: "agent-a",
      targetAgents: ["agent-b"],
    }),
    { ok: true, added: ["agent-b"] },
  );
  assert.deepEqual(
    registry.push({
      invocationId: "invocation-1",
      callerAgentId: "agent-a",
      targetAgents: ["agent-c"],
    }),
    { ok: false, added: [], reason: "depth_limit" },
  );
});

test("push still appends a new agent that was not covered by the parent worklist", () => {
  const registry = createRegistry(["agent-a", "agent-b"], 10);
  const entry = registry.get("invocation-1");
  assert.ok(entry);
  entry.currentIndex = 1;

  const result = registry.push({
    invocationId: "invocation-1",
    callerAgentId: "agent-b",
    targetAgents: ["agent-c"],
  });

  assert.deepEqual(result, { ok: true, added: ["agent-c"] });
  assert.deepEqual(entry.list, ["agent-a", "agent-b", "agent-c"]);
});
