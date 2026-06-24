import assert from "node:assert/strict";
import test from "node:test";
import { parseA2AMentions, parseMentions, stripCode } from "../src/routing/MentionParser.js";
import type { Agent } from "../src/types.js";

const baseAgent = {
  provider: "mock",
  model: "mock",
  rolePrompt: "",
  enabled: true,
  createdAt: 1,
} as const;

const agents: Agent[] = [
  {
    ...baseAgent,
    id: "agent-a",
    displayName: "Agent A",
    mentionHandles: ["@agent-a", "@arch"],
  },
  {
    ...baseAgent,
    id: "agent-b",
    displayName: "Agent B",
    mentionHandles: ["@agent-b", "@reviewer"],
  },
];

test("parseMentions resolves handles in message order and deduplicates agents", () => {
  const result = parseMentions("请 @reviewer 先看，再让 @arch 处理，最后 @agent-b 收尾", agents);

  assert.deepEqual(result, ["agent-b", "agent-a"]);
});

test("parseMentions ignores handles inside inline and fenced code", () => {
  const result = parseMentions(
    [
      "正常文本 @agent-a",
      "`@agent-b`",
      "```ts",
      "const target = '@reviewer';",
      "```",
    ].join("\n"),
    agents,
  );

  assert.deepEqual(result, ["agent-a"]);
});

test("parseMentions requires mention boundaries", () => {
  assert.deepEqual(parseMentions("email@agent-a.com @agent-b_suffix", agents), []);
  assert.deepEqual(parseMentions("（@agent-a）然后，@agent-b。", agents), ["agent-a", "agent-b"]);
});

test("stripCode removes inline and fenced code ranges", () => {
  assert.equal(stripCode("a `@agent-a` b\n```txt\n@agent-b\n```\nc"), "a  b\n\nc");
});

test("parseA2AMentions only routes line-start handoffs", () => {
  assert.deepEqual(parseA2AMentions("可用队友包括 @agent-b，但这里只是说明。", agents), []);
  assert.deepEqual(parseA2AMentions("@agent-b 请 review。\n@agent-a 请补充方案。", agents), [
    "agent-b",
    "agent-a",
  ]);
});

test("parseA2AMentions supports consecutive line-start handles and markdown prefixes", () => {
  assert.deepEqual(parseA2AMentions("- @agent-b @arch 请分别自我介绍。", agents), ["agent-b", "agent-a"]);
  assert.deepEqual(parseA2AMentions("> @reviewer 请确认。", agents), ["agent-b"]);
});
