"use client";

import { useCallback, useEffect, useState } from "react";
import type { Workspace } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";

export function useWorkspaces() {
  const client = useTowerClient();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const refresh = useCallback(async () => {
    setWorkspaces((await client.listWorkspaces()).workspaces);
  }, [client]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { workspaces, refresh };
}
