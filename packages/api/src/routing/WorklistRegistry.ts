import type { WorklistEntry } from "../types.js";

export type PushResult =
  | { ok: true; added: string[]; warning?: string }
  | { ok: false; added: string[]; reason: "not_found" | "caller_mismatch" | "depth_limit" | "duplicate" | "pingpong_blocked" };

const PINGPONG_WARN_THRESHOLD = 2;
const PINGPONG_BLOCK_THRESHOLD = 4;

export class WorklistRegistry {
  private readonly entries = new Map<string, WorklistEntry>();

  register(input: {
    invocationId: string;
    threadId: string;
    targetAgents: string[];
    maxDepth: number;
    abortController: AbortController;
  }): WorklistEntry {
    const entry: WorklistEntry = {
      invocationId: input.invocationId,
      threadId: input.threadId,
      list: [...input.targetAgents],
      currentIndex: 0,
      depth: 0,
      maxDepth: input.maxDepth,
      a2aFrom: {},
      triggerMessageId: {},
      abortController: input.abortController,
    };
    this.entries.set(input.invocationId, entry);
    return entry;
  }

  get(invocationId: string): WorklistEntry | undefined {
    return this.entries.get(invocationId);
  }

  unregister(invocationId: string): void {
    this.entries.delete(invocationId);
  }

  push(input: {
    invocationId: string;
    targetAgents: string[];
    callerAgentId?: string;
    triggerMessageId?: string;
  }): PushResult {
    const entry = this.entries.get(input.invocationId);
    if (!entry) return { ok: false, added: [], reason: "not_found" };

    if (input.callerAgentId) {
      const currentAgent = entry.list[entry.currentIndex];
      if (currentAgent !== input.callerAgentId) {
        return { ok: false, added: [], reason: "caller_mismatch" };
      }
    }

    const added: string[] = [];
    let warning: string | undefined;

    for (const agentId of input.targetAgents) {
      if (input.callerAgentId && agentId === input.callerAgentId) continue;

      if (entry.depth >= entry.maxDepth) {
        return { ok: false, added, reason: "depth_limit" };
      }

      const pending = entry.list.slice(entry.currentIndex + 1);
      const currentAgent = entry.list[entry.currentIndex];
      if (agentId === currentAgent) continue;
      if (pending.includes(agentId)) continue;

      if (input.callerAgentId) {
        const pingPong = updatePingPong(entry, input.callerAgentId, agentId);
        if (pingPong.blocked) return { ok: false, added, reason: "pingpong_blocked" };
        if (pingPong.warning) warning = pingPong.warning;
      }

      entry.list.push(agentId);
      entry.depth += 1;
      added.push(agentId);
      if (input.callerAgentId) entry.a2aFrom[agentId] = input.callerAgentId;
      if (input.triggerMessageId) entry.triggerMessageId[agentId] = input.triggerMessageId;
    }

    if (added.length === 0) return { ok: false, added: [], reason: "duplicate" };
    return { ok: true, added, ...(warning ? { warning } : {}) };
  }
}

function updatePingPong(
  entry: WorklistEntry,
  from: string,
  to: string,
): { warning?: string; blocked: boolean } {
  const samePair =
    entry.pingPong &&
    ((entry.pingPong.from === from && entry.pingPong.to === to) ||
      (entry.pingPong.from === to && entry.pingPong.to === from));

  if (samePair && entry.pingPong) {
    entry.pingPong = { from, to, count: entry.pingPong.count + 1 };
  } else {
    entry.pingPong = { from, to, count: 1 };
  }

  if (entry.pingPong.count >= PINGPONG_BLOCK_THRESHOLD) return { blocked: true };
  if (entry.pingPong.count >= PINGPONG_WARN_THRESHOLD) {
    return {
      blocked: false,
      warning: `A2A ping-pong warning: ${from} ↔ ${to} repeated ${entry.pingPong.count} times`,
    };
  }
  return { blocked: false };
}
