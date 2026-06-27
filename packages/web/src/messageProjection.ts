import type { Message } from "@the-tower/shared";

export function projectMessagesToBubbles(messages: Message[]): Message[] {
  const projected: Message[] = [];
  const duplicateKeys = new Map<string, number>();

  for (const message of messages) {
    const duplicateKey = getExactDuplicateKey(message);
    if (!duplicateKey) {
      projected.push(message);
      continue;
    }

    const existingIndex = duplicateKeys.get(duplicateKey);
    if (existingIndex === undefined) {
      duplicateKeys.set(duplicateKey, projected.length);
      projected.push(message);
      continue;
    }

    const existing = projected[existingIndex];
    if (!existing) continue;
    if (shouldPreferIncomingDuplicate(existing, message)) {
      projected[existingIndex] = message;
    }
  }

  return projected;
}

function getExactDuplicateKey(message: Message): string | undefined {
  if (message.senderType !== "agent" || !message.senderId || !message.invocationId) return undefined;
  const origin = message.origin ?? "agent_final";
  if (origin !== "callback" && origin !== "agent_final") return undefined;
  return [
    message.threadId,
    message.invocationId,
    message.senderId,
    normalizeContent(message.content),
    message.mentions.join(","),
    message.replyTo ?? "",
  ].join("\u0000");
}

function shouldPreferIncomingDuplicate(existing: Message, incoming: Message): boolean {
  const existingOrigin = existing.origin ?? "agent_final";
  const incomingOrigin = incoming.origin ?? "agent_final";
  if (incomingOrigin === "callback" && existingOrigin !== "callback") return true;
  return false;
}

function normalizeContent(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}
