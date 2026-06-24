import type { Agent } from "../types.js";

const FENCED_CODE_BLOCK_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`\n]+`/g;

export function stripCode(content: string): string {
  return content.replace(FENCED_CODE_BLOCK_RE, "").replace(INLINE_CODE_RE, "");
}

export function parseMentions(content: string, agents: Agent[]): string[] {
  const stripped = stripCode(content);
  const found = new Map<number, string>();

  for (const agent of agents) {
    for (const handle of agent.mentionHandles) {
      const escaped = escapeRegExp(handle);
      const pattern = new RegExp(`(^|[\\s,.:;!?()[\\]{}<>，。！？、：；（）【】《》])(${escaped})(?=$|[\\s,.:;!?()[\\]{}<>，。！？、：；（）【】《》])`, "gi");
      for (const match of stripped.matchAll(pattern)) {
        if (match.index === undefined) continue;
        const position = match.index + (match[1]?.length ?? 0);
        if (!found.has(position)) found.set(position, agent.id);
      }
    }
  }

  return [...found.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, id]) => id)
    .filter((id, index, arr) => arr.indexOf(id) === index);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
