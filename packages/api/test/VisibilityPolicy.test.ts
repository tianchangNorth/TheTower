import assert from "node:assert/strict";
import test from "node:test";
import {
  canIncludeInAgentContext,
  canQuoteInPublicReply,
  canViewMessage,
} from "../src/context/VisibilityPolicy.js";
import type { Message } from "../src/types.js";

test("canViewMessage lets user audit all messages", () => {
  assert.equal(canViewMessage(makeMessage({ visibility: "private" }), { type: "user" }), true);
  assert.equal(canViewMessage(makeMessage({ origin: "briefing" }), { type: "user" }), true);
});

test("canViewMessage allows public messages for any agent", () => {
  assert.equal(canViewMessage(makeMessage(), { type: "agent", agentId: "ikora" }), true);
  assert.equal(canViewMessage(makeMessage({ visibility: "public" }), { type: "agent", agentId: "banshee" }), true);
});

test("canViewMessage restricts private messages to visible agents until revealed", () => {
  const message = makeMessage({
    visibility: "private",
    visibleToAgentIds: ["ikora"],
  });

  assert.equal(canViewMessage(message, { type: "agent", agentId: "ikora" }), true);
  assert.equal(canViewMessage(message, { type: "agent", agentId: "banshee" }), false);
  assert.equal(
    canViewMessage({ ...message, revealedAt: 10 }, { type: "agent", agentId: "banshee" }),
    true,
  );
});

test("canIncludeInAgentContext excludes briefing and non-delivered messages", () => {
  assert.equal(
    canIncludeInAgentContext({
      message: makeMessage({ origin: "briefing" }),
      viewer: { type: "agent", agentId: "ikora" },
      mode: "debug",
    }),
    false,
  );

  assert.equal(
    canIncludeInAgentContext({
      message: makeMessage({ deliveryStatus: "queued" }),
      viewer: { type: "agent", agentId: "ikora" },
      mode: "debug",
    }),
    false,
  );
});

test("canIncludeInAgentContext hides other agent streams in play mode", () => {
  const stream = makeMessage({
    senderType: "agent",
    senderId: "ikora",
    origin: "agent_stream",
  });

  assert.equal(
    canIncludeInAgentContext({
      message: stream,
      viewer: { type: "agent", agentId: "banshee" },
      mode: "debug",
    }),
    true,
  );
  assert.equal(
    canIncludeInAgentContext({
      message: stream,
      viewer: { type: "agent", agentId: "banshee" },
      mode: "play",
    }),
    false,
  );
  assert.equal(
    canIncludeInAgentContext({
      message: stream,
      viewer: { type: "agent", agentId: "ikora" },
      mode: "play",
    }),
    true,
  );
});

test("canIncludeInAgentContext never shares thinking chunks across agents, even in debug", () => {
  const thinking = makeMessage({
    senderType: "agent",
    senderId: "ikora",
    origin: "agent_stream",
    extra: { stream: { invocationId: "inv-1", chunkType: "thinking" } },
  });

  assert.equal(
    canIncludeInAgentContext({
      message: thinking,
      viewer: { type: "agent", agentId: "banshee" },
      mode: "debug",
    }),
    false,
  );
  assert.equal(
    canIncludeInAgentContext({
      message: thinking,
      viewer: { type: "agent", agentId: "banshee" },
      mode: "play",
    }),
    false,
  );
  assert.equal(
    canIncludeInAgentContext({
      message: thinking,
      viewer: { type: "agent", agentId: "ikora" },
      mode: "play",
    }),
    true,
  );
});

test("canQuoteInPublicReply blocks unrevealed private, briefing, and undelivered parents", () => {
  assert.equal(canQuoteInPublicReply(makeMessage()), true);
  assert.equal(canQuoteInPublicReply(makeMessage({ visibility: "private" })), false);
  assert.equal(canQuoteInPublicReply(makeMessage({ visibility: "private", revealedAt: 10 })), true);
  assert.equal(canQuoteInPublicReply(makeMessage({ origin: "briefing" })), false);
  assert.equal(canQuoteInPublicReply(makeMessage({ deliveryStatus: "canceled" })), false);
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
