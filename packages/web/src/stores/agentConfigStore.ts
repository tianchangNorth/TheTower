"use client";

import { create } from "zustand";
import type { Agent } from "@the-tower/shared";

export type AgentConfigStatus = "idle" | "saving" | "saved" | "error";

interface DraftEntry {
  original: Agent;
  working: Agent;
}

interface AgentConfigState {
  drafts: Record<string, DraftEntry>;
  status: Record<string, AgentConfigStatus>;
  error: Record<string, string | undefined>;
  init: (agent: Agent) => void;
  patch: (agentId: string, patch: Partial<Agent>) => void;
  setSaving: (agentId: string) => void;
  setSaved: (agentId: string, agent: Agent) => void;
  setError: (agentId: string, message: string) => void;
  clearSaved: (agentId: string) => void;
  reset: (agentId: string) => void;
}

function eq(a: Agent, b: Agent): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Agent 配置草稿 store：per-agent working/original，支持 dirty / saving / saved / error。 */
export const useAgentConfigStore = create<AgentConfigState>((set) => ({
  drafts: {},
  status: {},
  error: {},
  init: (agent) =>
    set((s) => {
      const existing = s.drafts[agent.id];
      // 已有未保存草稿：只刷新 original，保留 working 避免覆盖编辑。
      if (existing) {
        return { drafts: { ...s.drafts, [agent.id]: { ...existing, original: agent } } };
      }
      return { drafts: { ...s.drafts, [agent.id]: { original: agent, working: agent } } };
    }),
  patch: (agentId, patch) =>
    set((s) => {
      const entry = s.drafts[agentId];
      if (!entry) return {};
      return {
        drafts: { ...s.drafts, [agentId]: { ...entry, working: { ...entry.working, ...patch } } },
      };
    }),
  setSaving: (agentId) =>
    set((s) => ({ status: { ...s.status, [agentId]: "saving" }, error: { ...s.error, [agentId]: undefined } })),
  setSaved: (agentId, agent) =>
    set((s) => ({
      status: { ...s.status, [agentId]: "saved" },
      drafts: { ...s.drafts, [agentId]: { original: agent, working: agent } },
      error: { ...s.error, [agentId]: undefined },
    })),
  setError: (agentId, message) =>
    set((s) => ({ status: { ...s.status, [agentId]: "error" }, error: { ...s.error, [agentId]: message } })),
  clearSaved: (agentId) =>
    set((s) => ({
      status: { ...s.status, [agentId]: s.status[agentId] === "saved" ? "idle" : s.status[agentId] },
    })),
  reset: (agentId) =>
    set((s) => {
      const next = { ...s.drafts };
      delete next[agentId];
      return { drafts: next };
    }),
}));

export function isDraftDirty(entry: DraftEntry | undefined): boolean {
  if (!entry) return false;
  return !eq(entry.original, entry.working);
}
