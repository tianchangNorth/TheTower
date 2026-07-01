"use client";

import { create } from "zustand";
import type { TelemetryThreadSummary, ToolAuditRow } from "@the-tower/shared";

export type WorkspaceFeedStatus = "idle" | "loading" | "error";

interface WorkspaceState {
  threads: TelemetryThreadSummary[];
  activity: ToolAuditRow[];
  status: WorkspaceFeedStatus;
  error?: string;
  setActivity: (
    threads: TelemetryThreadSummary[],
    activity: ToolAuditRow[],
    status: WorkspaceFeedStatus,
    error?: string,
  ) => void;
  reset: () => void;
}

/** 选中 workspace 的 thread 绑定 + 工具活动缓存。 */
export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  threads: [],
  activity: [],
  status: "idle",
  error: undefined,
  setActivity: (threads, activity, status, error) =>
    set({ threads, activity, status, error }),
  reset: () => set({ threads: [], activity: [], status: "idle", error: undefined }),
}));
