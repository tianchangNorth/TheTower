import type { Agent } from "../types.js";

const FENCED_CODE_BLOCK_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`\n]+`/g;
const LEADING_MARKDOWN_MENTION_PREFIX_RE = /^(?:(?:>\s*)|(?:[-*+]\s+)|(?:\d+[.)]\s+))+/;
const MENTION_BOUNDARY_RE = /[\s,.:;!?()[\]{}<>，。！？、：；（）【】《》「」『』〈〉]/;
const HANDLE_CONTINUATION_RE = /[a-z0-9_.-]/i;

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

export function parseA2AMentions(content: string, agents: Agent[]): string[] {
  const entries = agents.flatMap((agent) =>
    agent.mentionHandles.map((handle) => ({ agentId: agent.id, handle: handle.toLowerCase() })),
  );
  entries.sort((a, b) => b.handle.length - a.handle.length);

  const found: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of stripCode(content).split(/\r?\n/)) {
    const normalized = rawLine.trimStart().toLowerCase().replace(LEADING_MARKDOWN_MENTION_PREFIX_RE, "");
    if (!normalized.startsWith("@")) continue;

    let cursor = 0;
    while (cursor < normalized.length) {
      const segment = normalized.slice(cursor);
      const matched = entries.find((entry) => {
        if (!segment.startsWith(entry.handle)) return false;
        const charAfter = segment[entry.handle.length];
        return !charAfter || MENTION_BOUNDARY_RE.test(charAfter) || !HANDLE_CONTINUATION_RE.test(charAfter);
      });
      if (!matched) break;
      if (!seen.has(matched.agentId)) {
        seen.add(matched.agentId);
        found.push(matched.agentId);
      }

      cursor += matched.handle.length;
      while (cursor < normalized.length && MENTION_BOUNDARY_RE.test(normalized[cursor]!)) cursor++;
      if (normalized[cursor] !== "@") break;
    }
  }

  return found;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
