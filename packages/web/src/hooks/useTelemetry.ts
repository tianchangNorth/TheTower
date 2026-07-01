"use client";

import { useCallback, useEffect } from "react";
import type { TelemetryQueryParams } from "@the-tower/sdk";
import { useTowerClient } from "./useTowerClient";
import { useTelemetryStore } from "@/stores/telemetryStore";

/**
 * 按 URL filter 拉取 Telemetry 四个 feed（threads / invocations / events / tool-audit）。
 * 结果写入 telemetryStore；filter 是 URL 派生的稳定对象，变化才重拉。
 */
export function useTelemetry(filters: TelemetryQueryParams) {
  const client = useTowerClient();
  const setThreads = useTelemetryStore((s) => s.setThreads);
  const setInvocations = useTelemetryStore((s) => s.setInvocations);
  const setEvents = useTelemetryStore((s) => s.setEvents);
  const setToolAudit = useTelemetryStore((s) => s.setToolAudit);

  const refresh = useCallback(async () => {
    setThreads([], "loading");
    setInvocations([], "loading");
    setEvents([], "loading");
    setToolAudit([], "loading");

    const [t, i, e, a] = await Promise.allSettled([
      client.getTelemetryThreads(),
      client.queryInvocations(filters),
      client.queryTelemetryEvents(filters),
      client.queryToolAudit(filters),
    ]);

    if (t.status === "fulfilled") setThreads(t.value.threads, "idle");
    else setThreads([], "error", (t.reason as Error)?.message);
    if (i.status === "fulfilled") setInvocations(i.value.invocations, "idle");
    else setInvocations([], "error", (i.reason as Error)?.message);
    if (e.status === "fulfilled") setEvents(e.value.events, "idle");
    else setEvents([], "error", (e.reason as Error)?.message);
    if (a.status === "fulfilled") setToolAudit(a.value.rows, "idle");
    else setToolAudit([], "error", (a.reason as Error)?.message);
  }, [client, filters, setThreads, setInvocations, setEvents, setToolAudit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { refresh };
}
