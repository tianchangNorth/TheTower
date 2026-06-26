import assert from "node:assert/strict";
import test from "node:test";
import { ContextBuilder } from "../src/context/ContextBuilder.js";
import type { Message } from "../src/types.js";

test("ContextBuilder debug mode excludes briefing and undelivered messages but keeps debug-visible private context", () => {
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
    ["public", "private"],
  );
});

test("ContextBuilder play mode filters private messages and other-agent streams", () => {
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

  assert.deepEqual(
    context.messages.map((message) => message.id),
    ["public", "private-banshee", "stream-banshee", "revealed"],
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
    origin: "agent_final",
    deliveryStatus: "delivered",
    createdAt: 1,
    ...overrides,
  };
}
