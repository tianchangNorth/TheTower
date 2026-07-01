"use client";

import { useCallback, useEffect } from "react";
import { useTowerClient } from "./useTowerClient";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function useWorkspaceActivity(workspaceId: string | undefined) {
  const client = useTowerClient();
  const setActivity = useWorkspaceStore((s) => s.setActivity);
  const reset = useWorkspaceStore((s) => s.reset);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      reset();
      return;
    }
    setActivity([], [], "loading");
    try {
      const res = await client.getWorkspaceActivity(workspaceId);
      setActivity(res.threads, res.activity, "idle");
    } catch (err) {
      setActivity([], [], "error", (err as Error).message);
    }
  }, [client, workspaceId, setActivity, reset]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { refresh };
}
