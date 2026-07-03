"use client";

import { useCallback, useEffect, useState } from "react";
import { useTowerClient } from "./useTowerClient";
import {
  applyRuntimeStatusSnapshot,
  hydrateRuntimeStatuses,
  type AgentRuntimeStatusMap,
} from "@/runtimeStatus";
import { isAgentRuntimeEvent } from "@/lib/eventFlow";
import type { ServerEvent } from "@/types";

export function useThreadRuntime() {
  const client = useTowerClient();
  const [statuses, setStatuses] = useState<AgentRuntimeStatusMap>({});
  const refresh = useCallback(async () => {
    try {
      setStatuses(hydrateRuntimeStatuses((await client.listAgentRuntimeStatuses()).statuses));
    } catch (err) {
      // API unreachable (e.g. dev server down/restarting, or SSE disconnect
      // triggering a refresh). Leave existing statuses stale rather than
      // surfacing an unhandled rejection — matches useHealth's swallow pattern.
      console.warn("[useThreadRuntime] refresh failed:", err);
    }
  }, [client]);
  const applyEvent = useCallback((event: ServerEvent) => {
    if (isAgentRuntimeEvent(event)) {
      setStatuses((items) => applyRuntimeStatusSnapshot(items, event.status));
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { statuses, refresh, applyEvent };
}
