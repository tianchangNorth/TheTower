"use client";

import { useCallback, useEffect, useState } from "react";
import type { Thread } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";

export function useThreads() {
  const client = useTowerClient();
  const [threads, setThreads] = useState<Thread[]>([]);
  const refresh = useCallback(async () => {
    setThreads((await client.listThreads()).threads);
  }, [client]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const deleteThread = useCallback(
    async (threadId: string) => {
      await client.deleteThread(threadId);
      await refresh();
    },
    [client, refresh],
  );
  return { threads, refresh, deleteThread };
}
