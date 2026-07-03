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

test("canIncludeInAgentContext hides all agent streams in play mode, including the originator's own", () => {
  const stream = makeMessage({
    senderType: "agent",
    senderId: "ikora",
    origin: "agent_stream",
  });

  // debug mode keeps operator-level transparency: other agents' streams visible
  assert.equal(
    canIncludeInAgentContext({
      message: stream,
      viewer: { type: "agent", agentId: "banshee" },
      mode: "debug",
    }),
    true,
  );
  // play mode: other agents' streams hidden
  assert.equal(
    canIncludeInAgentContext({
      message: stream,
      viewer: { type: "agent", agentId: "banshee" },
      mode: "play",
    }),
    false,
  );
  // play mode: even the originator does not see its own stream in context — stream is
  // operator-private; agents work from callback speech + navigation, not raw process.
  assert.equal(
    canIncludeInAgentContext({
      message: stream,
      viewer: { type: "agent", agentId: "ikora" },
      mode: "play",
    }),
    false,
  );
});

test("canIncludeInAgentContext hides thinking from other agents (debug) and from everyone in play", () => {
  const thinking = makeMessage({
    senderType: "agent",
    senderId: "ikora",
    origin: "agent_stream",
    extra: { stream: { invocationId: "inv-1", chunkType: "thinking" } },
  });

  // debug: thinking is still never shared across agents — only the originator sees its own
  assert.equal(
    canIncludeInAgentContext({
      message: thinking,
      viewer: { type: "agent", agentId: "banshee" },
      mode: "debug",
    }),
    false,
  );
  // play: other agents can't see it
  assert.equal(
    canIncludeInAgentContext({
      message: thinking,
      viewer: { type: "agent", agentId: "banshee" },
      mode: "play",
    }),
    false,
  );
  // play: originator can't see its own thinking either (agent_stream is private in play)
  assert.equal(
    canIncludeInAgentContext({
      message: thinking,
      viewer: { type: "agent", agentId: "ikora" },
      mode: "play",
    }),
    false,
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
