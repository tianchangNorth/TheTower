import type { TaskPriority, TaskStatus } from "@the-tower/shared";

type Tone = "idle" | "thinking" | "tool-calling" | "replying" | "done" | "error" | "stall" | "void" | "info";

export function taskStatusTone(status: TaskStatus): Tone {
  switch (status) {
    case "todo":
      return "info";
    case "in_progress":
      return "thinking";
    case "done":
      return "done";
    case "blocked":
      return "stall";
    case "cancelled":
      return "error";
  }
}

export function taskPriorityTone(priority: TaskPriority): Tone {
  switch (priority) {
    case "low":
      return "info";
    case "medium":
      return "info";
    case "high":
      return "thinking";
    case "urgent":
      return "error";
  }
}

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "blocked", "cancelled"];
export const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
