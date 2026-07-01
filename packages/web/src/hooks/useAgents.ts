"use client";

import { useCallback, useEffect, useState } from "react";
import type { Agent } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";

export function useAgents() {
  const client = useTowerClient();
  const [agents, setAgents] = useState<Agent[]>([]);
  const refresh = useCallback(async () => {
    const result = await client.listAgents();
    setAgents(result.agents);
  }, [client]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { agents, refresh };
}
