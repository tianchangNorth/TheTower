import type { Message, ThreadMode } from "../types.js";

export type ContextViewer =
  | { type: "user" }
  | { type: "agent"; agentId: string };

export function canViewMessage(message: Message, viewer: ContextViewer): boolean {
  if (viewer.type === "user") return true;

  if (!message.visibility || message.visibility === "public") return true;

  if (message.visibility === "private") {
    if (message.revealedAt) return true;
    return message.visibleToAgentIds?.includes(viewer.agentId) ?? false;
  }

  return false;
}

export function canIncludeInAgentContext(input: {
  message: Message;
  viewer: { type: "agent"; agentId: string };
  mode: ThreadMode;
}): boolean {
  const { message, viewer, mode } = input;
  if (!isDelivered(message)) return false;
  if (message.origin === "briefing") return false;
  if (!canViewMessage(message, viewer)) return false;

  // Play mode: agent_stream (CLI stdout — text, tool_call, thinking) is private to the
  // operator. It never enters any agent's context, including the originator's own. Agents
  // work from callback (post_message) speech + navigation, not raw process stream. This
  // aligns with a2a-channel-semantics ("stdout 是私有 CLI 输出，不会自动公开到 thread")
  // and mirrors clowder route-helpers.ts (play mode excludes all stream from cat context).
  if (mode === "play" && message.origin === "agent_stream") {
    return false;
  }

  // Stream chunks are compacted into one row per invocation+agent. In debug mode an
  // other-agent row may contain both shareable stdout/tool output and private thinking.
  // Keep a thinking-only row private; ContextBuilder redacts the thinking field from
  // mixed rows before returning them to another agent.
  if (
    message.origin === "agent_stream" &&
    message.senderType === "agent" &&
    message.senderId !== viewer.agentId &&
    !message.content.trim() &&
    !(message.toolEvents?.length)
  ) {
    return false;
  }

  return true;
}

export function canQuoteInPublicReply(message: Message): boolean {
  if (message.visibility === "private" && !message.revealedAt) return false;
  if (message.origin === "briefing") return false;
  if (!isDelivered(message)) return false;
  return true;
}

function isDelivered(message: Message): boolean {
  return !message.deliveryStatus || message.deliveryStatus === "delivered";
}
