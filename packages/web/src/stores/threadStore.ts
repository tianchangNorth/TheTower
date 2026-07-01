"use client";

import { create } from "zustand";
import type { MessageAuditFilter } from "@/types";

// 新 thread（未持久化 id）用哨兵键，保证 draft/filter 在"新建"态也保留。
const NEW = "__new__";
const key = (id: string | undefined) => (id ? id : NEW);

interface ThreadState {
  currentThreadId: string | undefined;
  setCurrentThreadId: (id: string | undefined) => void;
  draftByThreadId: Record<string, string>;
  filterByThreadId: Record<string, MessageAuditFilter>;
  unreadByThreadId: Record<string, number>;
  getDraft: (id: string | undefined) => string;
  setDraft: (id: string | undefined, value: string) => void;
  getFilter: (id: string | undefined) => MessageAuditFilter;
  setFilter: (id: string | undefined, value: MessageAuditFilter) => void;
  bumpUnread: (id: string, delta: number) => void;
  clearUnread: (id: string | undefined) => void;
}

/**
 * thread-scoped store：切换 thread 不清空其他 thread 的 draft / filter。
 * currentThreadId 由路由驱动（CommandShell 同步），URL 是 source of truth。
 */
export const useThreadStore = create<ThreadState>((set, get) => ({
  currentThreadId: undefined,
  setCurrentThreadId: (id) => set({ currentThreadId: id }),
  draftByThreadId: {},
  filterByThreadId: {},
  unreadByThreadId: {},
  getDraft: (id) => get().draftByThreadId[key(id)] ?? "",
  setDraft: (id, value) =>
    set((s) => ({ draftByThreadId: { ...s.draftByThreadId, [key(id)]: value } })),
  getFilter: (id) => get().filterByThreadId[key(id)] ?? "all",
  setFilter: (id, value) =>
    set((s) => ({ filterByThreadId: { ...s.filterByThreadId, [key(id)]: value } })),
  bumpUnread: (id, delta) =>
    set((s) => ({ unreadByThreadId: { ...s.unreadByThreadId, [id]: (s.unreadByThreadId[id] ?? 0) + delta } })),
  clearUnread: (id) =>
    set((s) => {
      if (!id) return {};
      const next = { ...s.unreadByThreadId };
      delete next[id];
      return { unreadByThreadId: next };
    }),
}));
