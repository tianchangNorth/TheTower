import type { Message, MessageOrigin, MessageVisibility } from "@the-tower/shared";
import { messageAuditFilters, type MessageAuditFilter } from "@/types";

export { messageAuditFilters };
export type { MessageAuditFilter };

export function getMessageVisibility(message: Message): MessageVisibility {
  return message.visibility ?? "public";
}

export function getMessageOrigin(message: Message): MessageOrigin {
  return message.origin ?? "agent_final";
}

export function buildMessageAuditCounts(messages: Message[]): Record<MessageAuditFilter, number> {
  return {
    all: messages.length,
    private: messages.filter((m) => getMessageVisibility(m) === "private").length,
    callback: messages.filter((m) => getMessageOrigin(m) === "callback").length,
    privateCallback: messages.filter(
      (m) => getMessageVisibility(m) === "private" && getMessageOrigin(m) === "callback",
    ).length,
    revealed: messages.filter((m) => Boolean(m.revealedAt)).length,
    handoff: messages.filter((m) => Boolean(m.handoffPayload)).length,
  };
}

export function matchesMessageAuditFilter(message: Message, filter: MessageAuditFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "private":
      return getMessageVisibility(message) === "private";
    case "callback":
      return getMessageOrigin(message) === "callback";
    case "privateCallback":
      return getMessageVisibility(message) === "private" && getMessageOrigin(message) === "callback";
    case "revealed":
      return Boolean(message.revealedAt);
    case "handoff":
      return Boolean(message.handoffPayload);
  }
}
