"use client";

import { useCallback, useEffect } from "react";
import type { CreateTaskRequest, UpdateTaskRequest } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";
import { useTaskStore } from "@/stores/taskStore";

export function useTaskBoard() {
  const client = useTowerClient();
  const setTasks = useTaskStore((s) => s.setTasks);
  const upsertTask = useTaskStore((s) => s.upsertTask);

  const refresh = useCallback(async () => {
    setTasks([], "loading");
    try {
      setTasks((await client.listTasks()).tasks, "idle");
    } catch (err) {
      setTasks([], "error", (err as Error).message);
    }
  }, [client, setTasks]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTask = useCallback(
    async (input: CreateTaskRequest) => {
      const { task } = await client.createTask(input);
      upsertTask(task);
      return task;
    },
    [client, upsertTask],
  );

  const updateTask = useCallback(
    async (taskId: string, input: UpdateTaskRequest) => {
      const { task } = await client.updateTask(taskId, input);
      upsertTask(task);
      return task;
    },
    [client, upsertTask],
  );

  return { refresh, createTask, updateTask };
}
