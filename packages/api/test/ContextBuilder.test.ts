import assert from "node:assert/strict";
import test from "node:test";
import { ContextBuilder } from "../src/context/ContextBuilder.js";
import type { Message } from "../src/types.js";

test("ContextBuilder debug mode excludes briefing, undelivered, and non-visible private messages", () => {
  const builder = new ContextBuilder({
    messageStore: {
      listByThread: () => [
        makeMessage({ id: "public" }),
        makeMessage({ id: "private", visibility: "private", visibleToAgentIds: ["ikora"] }),
        makeMessage({ id: "briefing", origin: "briefing" }),
        makeMessage({ id: "queued", deliveryStatus: "queued" }),
      ],
    },
  });

  const context = builder.buildForAgent({
    threadId: "thread-1",
    agentId: "banshee",
    mode: "debug",
  });

  assert.deepEqual(
    context.messages.map((message) => message.id),
    ["public"],
  );
});

test("ContextBuilder play mode filters private messages and all agent streams (own + other)", () => {
  const builder = new ContextBuilder({
    messageStore: {
      listByThread: () => [
        makeMessage({ id: "public" }),
        makeMessage({ id: "private-ikora", visibility: "private", visibleToAgentIds: ["ikora"] }),
        makeMessage({ id: "private-banshee", visibility: "private", visibleToAgentIds: ["banshee"] }),
        makeMessage({ id: "stream-ikora", senderId: "ikora", origin: "agent_stream" }),
        makeMessage({ id: "stream-banshee", senderId: "banshee", origin: "agent_stream" }),
        makeMessage({ id: "revealed", visibility: "private", visibleToAgentIds: ["ikora"], revealedAt: 10 }),
      ],
    },
  });

  const context = builder.buildForAgent({
    threadId: "thread-1",
    agentId: "banshee",
    mode: "play",
  });

  // agent_stream (CLI stdout) is operator-private in play mode: neither other agents' nor
  // the originator's own stream enters context. Agents work from callback speech, not process.
  assert.deepEqual(
    context.messages.map((message) => message.id),
    ["public", "private-banshee", "revealed"],
  );
});

test("ContextBuilder passes limit through to MessageStore", () => {
  let seenLimit: number | undefined;
  const builder = new ContextBuilder({
    messageStore: {
      listByThread: (_threadId, limit) => {
        seenLimit = limit;
        return [];
      },
    },
  });

  builder.buildForAgent({ threadId: "thread-1", agentId: "ikora", limit: 25 });

  assert.equal(seenLimit, 25);
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
    createdAt: 1,
    ...overrides,
  };
}
