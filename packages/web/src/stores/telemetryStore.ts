"use client";

import { create } from "zustand";
import type {
  Invocation,
  TelemetryEventEntry,
  TelemetryThreadSummary,
  ToolAuditRow,
} from "@the-tower/shared";

export type FeedStatus = "idle" | "loading" | "error";

interface FeedKey {
  threads: TelemetryThreadSummary[];
  invocations: Invocation[];
  events: TelemetryEventEntry[];
  toolAudit: ToolAuditRow[];
}

interface TelemetryState extends FeedKey {
  status: { threads: FeedStatus; invocations: FeedStatus; events: FeedStatus; toolAudit: FeedStatus };
  error: { threads?: string; invocations?: string; events?: string; toolAudit?: string };
  setThreads: (data: TelemetryThreadSummary[], status: FeedStatus, error?: string) => void;
  setInvocations: (data: Invocation[], status: FeedStatus, error?: string) => void;
  setEvents: (data: TelemetryEventEntry[], status: FeedStatus, error?: string) => void;
  setToolAudit: (data: ToolAuditRow[], status: FeedStatus, error?: string) => void;
  reset: () => void;
}

const initialStatus = { threads: "idle", invocations: "idle", events: "idle", toolAudit: "idle" } as const;

/** Telemetry 结果缓存。filter 走 URL（source of truth），store 只持查询结果与状态。 */
export const useTelemetryStore = create<TelemetryState>((set) => ({
  threads: [],
  invocations: [],
  events: [],
  toolAudit: [],
  status: { ...initialStatus },
  error: {},
  setThreads: (data, status, error) =>
    set((s) => ({ threads: data, status: { ...s.status, threads: status }, error: { ...s.error, threads: error } })),
  setInvocations: (data, status, error) =>
    set((s) => ({ invocations: data, status: { ...s.status, invocations: status }, error: { ...s.error, invocations: error } })),
  setEvents: (data, status, error) =>
    set((s) => ({ events: data, status: { ...s.status, events: status }, error: { ...s.error, events: error } })),
  setToolAudit: (data, status, error) =>
    set((s) => ({ toolAudit: data, status: { ...s.status, toolAudit: status }, error: { ...s.error, toolAudit: error } })),
  reset: () => set({ threads: [], invocations: [], events: [], toolAudit: [], status: { ...initialStatus }, error: {} }),
}));
