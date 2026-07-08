import { test } from "node:test";
import assert from "node:assert/strict";
import type { Message } from "@the-tower/shared";
import { projectMessagesToBubbles } from "../src/messageProjection";

test("projectMessagesToBubbles keeps thinking and CLI stream output", () => {
  const messages: Message[] = [
    makeMessage({
      id: "stream-cli",
      content: "mcp__thetower__post_message(...)",
      toolEvents: [{ id: "tool-1", type: "tool_use", label: "mcp__thetower__post_message", timestamp: 1 }],
      extra: { stream: { invocationId: "invocation-1", chunkType: "tool_call" } },
    }),
    makeMessage({
      id: "stream-1",
      content: "",
      thinking: "先分析用户意图。",
      extra: { stream: { invocationId: "invocation-1", chunkType: "thinking" } },
      createdAt: 2,
    }),
  ];

  const projected = projectMessagesToBubbles(messages);

  assert.equal(projected.length, 2);
  assert.equal(projected[0]?.origin, "agent_stream");
  assert.equal(projected[0]?.toolEvents?.[0]?.label, "mcp__thetower__post_message");
  assert.equal(projected[1]?.thinking, "先分析用户意图。");
});

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "message-1",
    threadId: "thread-1",
    senderType: "agent",
    senderId: "zavala",
    content: "content",
    mentions: [],
    origin: "agent_stream",
    deliveryStatus: "delivered",
    invocationId: "invocation-1",
    createdAt: 1,
    ...overrides,
  };
}
