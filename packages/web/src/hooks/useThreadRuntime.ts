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

export function useThreadRuntime(threadId?: string) {
  const client = useTowerClient();
  const [statuses, setStatuses] = useState<AgentRuntimeStatusMap>({});
  const refresh = useCallback(async () => {
    try {
      const result = threadId
        ? await client.getThreadAgentStatuses(threadId)
        : await client.listAgentRuntimeStatuses();
      setStatuses(hydrateRuntimeStatuses(result.statuses));
    } catch (err) {
      // API unreachable (e.g. dev server down/restarting, or SSE disconnect
      // triggering a refresh). Leave existing statuses stale rather than
      // surfacing an unhandled rejection — matches useHealth's swallow pattern.
      console.warn("[useThreadRuntime] refresh failed:", err);
    }
  }, [client, threadId]);
  const applyEvent = useCallback((event: ServerEvent) => {
    if (isAgentRuntimeEvent(event)) {
      if (threadId && event.status.threadId !== threadId) return;
      setStatuses((items) => applyRuntimeStatusSnapshot(items, event.status));
    }
  }, [threadId]);
  useEffect(() => {
    setStatuses({});
    void refresh();
  }, [refresh]);
  return { statuses, refresh, applyEvent };
}
