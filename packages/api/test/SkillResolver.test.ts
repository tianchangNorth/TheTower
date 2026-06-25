import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { SkillRegistry } from "../src/skills/SkillRegistry.js";
import { SkillResolver } from "../src/skills/SkillResolver.js";
import type { Agent, Message } from "../src/types.js";

const projectRoot = resolve(import.meta.dirname, "../../..");

test("SkillRegistry loads file-based skills", () => {
  const registry = new SkillRegistry(resolve(projectRoot, "skills"));
  registry.load();

  const skills = registry.list();
  assert.ok(skills.length >= 3);
  assert.ok(registry.get("thread-orchestration"));
  assert.ok(registry.get("cross-agent-handoff"));
  assert.ok(registry.get("receive-handoff-grounding"));
  assert.ok(registry.get("quality-gate"));
  assert.ok(registry.get("request-review"));
  assert.ok(registry.get("receive-review"));
  assert.ok(registry.get("context-self-management"));
});

test("SkillResolver enables handoff skill before the last worklist item", () => {
  const resolver = createResolver();

  const skills = resolver.resolve({
    agent: makeAgent("agent-a"),
    messages: makeMessages(),
    worklist: {
      list: ["agent-a", "agent-b"],
      currentIndex: 0,
      a2aFrom: {},
    },
  });

  assert.deepEqual(skills.map((skill) => skill.id), ["thread-orchestration", "cross-agent-handoff"]);
});

test("SkillResolver enables receive and quality skills for a handed-off final agent", () => {
  const resolver = createResolver();

  const skills = resolver.resolve({
    agent: makeAgent("agent-b"),
    messages: makeMessages(),
    worklist: {
      list: ["agent-a", "agent-b"],
      currentIndex: 1,
      a2aFrom: { "agent-b": "agent-a" },
    },
  });

  assert.deepEqual(skills.map((skill) => skill.id), [
    "thread-orchestration",
    "receive-handoff-grounding",
    "quality-gate",
  ]);
});

test("SkillResolver enables manifest keyword skills from latest message", () => {
  const resolver = createResolver();

  const skills = resolver.resolve({
    agent: makeAgent("agent-a"),
    messages: [
      {
        id: "message-1",
        threadId: "thread-1",
        senderType: "user",
        content: "请 review 当前实现",
        mentions: [],
        createdAt: 1,
      },
    ],
    worklist: {
      list: ["agent-a"],
      currentIndex: 0,
      a2aFrom: {},
    },
  });

  assert.ok(skills.some((skill) => skill.id === "request-review"));
  assert.ok(skills.some((skill) => skill.id === "thread-orchestration"));
});

function createResolver(): SkillResolver {
  const registry = new SkillRegistry(resolve(projectRoot, "skills"));
  registry.load();
  return new SkillResolver(registry);
}

function makeAgent(id: string): Agent {
  return {
    id,
    displayName: id,
    mentionHandles: [`@${id}`],
    provider: "mock",
    model: "mock",
    rolePrompt: "",
    enabled: true,
    createdAt: 1,
  };
}

function makeMessages(): Message[] {
  return [
    {
      id: "message-1",
      threadId: "thread-1",
      senderType: "user",
      content: "@agent-a 开始",
      mentions: ["agent-a"],
      createdAt: 1,
    },
  ];
}
