"use client";

import { useCallback, useEffect, useState } from "react";
import type { Workspace } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";

export function useWorkspace(workspaceId: string | undefined) {
  const client = useTowerClient();
  const [workspace, setWorkspace] = useState<Workspace | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setWorkspace(undefined);
      setError(undefined);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      setWorkspace((await client.getWorkspace(workspaceId)).workspace);
    } catch (err) {
      setWorkspace(undefined);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client, workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { workspace, loading, error, refresh };
}
