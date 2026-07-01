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
    setStatuses(hydrateRuntimeStatuses((await client.listAgentRuntimeStatuses()).statuses));
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
