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

  // thinking chunks are never shared across agents, regardless of mode (stricter than
  // ordinary stream text). Even in debug mode only the originator sees their own thinking.
  if (message.extra?.stream?.chunkType === "thinking") {
    return message.senderType !== "agent" || message.senderId === viewer.agentId;
  }

  if (mode === "play" && message.origin === "agent_stream") {
    return message.senderType !== "agent" || message.senderId === viewer.agentId;
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
