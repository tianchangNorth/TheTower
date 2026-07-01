"use client";

import { create } from "zustand";
import type { Task, Thread } from "@the-tower/shared";

export type FeedStatus = "idle" | "loading" | "error";

interface TaskState {
  tasks: Task[];
  status: FeedStatus;
  error?: string;
  selected?: Task;
  selectedThreads: Thread[];
  selectedStatus: FeedStatus;
  selectedError?: string;
  setTasks: (tasks: Task[], status: FeedStatus, error?: string) => void;
  upsertTask: (task: Task) => void;
  setSelected: (
    task: Task | undefined,
    threads: Thread[],
    status: FeedStatus,
    error?: string,
  ) => void;
  reset: () => void;
}

/** Tasks 列表 + 选中 task 的详情/绑定线程缓存。 */
export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  status: "idle",
  error: undefined,
  selected: undefined,
  selectedThreads: [],
  selectedStatus: "idle",
  selectedError: undefined,
  setTasks: (tasks, status, error) => set({ tasks, status, error }),
  upsertTask: (task) =>
    set((s) => ({
      tasks: s.tasks.some((t) => t.id === task.id)
        ? s.tasks.map((t) => (t.id === task.id ? task : t))
        : [task, ...s.tasks],
    })),
  setSelected: (task, threads, status, error) =>
    set({ selected: task, selectedThreads: threads, selectedStatus: status, selectedError: error }),
  reset: () =>
    set({
      tasks: [],
      status: "idle",
      error: undefined,
      selected: undefined,
      selectedThreads: [],
      selectedStatus: "idle",
      selectedError: undefined,
    }),
}));
