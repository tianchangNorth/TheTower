import type { Message } from "@the-tower/shared";

export function shortId(id: string | undefined): string {
  if (!id) return "unknown";
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function senderLabel(message: Message): string {
  if (message.senderType === "user") return "Guardian";
  return message.senderId ?? message.senderType;
}

export function workspaceLabel(projectPath: string | undefined): string {
  if (!projectPath) return "No workspace";
  const parts = projectPath.split("/").filter(Boolean);
  return parts.at(-1) ?? projectPath;
}

export function splitList(text: string): string[] {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
