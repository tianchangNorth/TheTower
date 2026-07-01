"use client";

import { useCallback, useEffect } from "react";
import type { CreateTaskThreadRequest } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";
import { useTaskStore } from "@/stores/taskStore";

export function useTaskDetail(taskId: string | undefined) {
  const client = useTowerClient();
  const setSelected = useTaskStore((s) => s.setSelected);

  const refresh = useCallback(async () => {
    if (!taskId) {
      setSelected(undefined, [], "idle");
      return;
    }
    setSelected(undefined, [], "loading");
    try {
      const [taskRes, threadsRes] = await Promise.all([
        client.getTask(taskId),
        client.getTaskThreads(taskId).catch(() => ({ threads: [] })),
      ]);
      setSelected(taskRes.task, threadsRes.threads, "idle");
    } catch (err) {
      setSelected(undefined, [], "error", (err as Error).message);
    }
  }, [client, taskId, setSelected]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createThread = useCallback(
    async (input: CreateTaskThreadRequest) => {
      if (!taskId) throw new Error("no task");
      const { task, thread } = await client.createTaskThread(taskId, input);
      await refresh();
      return { task, thread };
    },
    [client, taskId, refresh],
  );

  return { refresh, createThread };
}
