import type Database from "better-sqlite3";
import type { Task, TaskPriority, TaskStatus } from "../types.js";

interface TaskRow {
  id: string;
  title: string;
  summary: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  tags_json: string;
  owner_agent_id: string | null;
  project_path: string | null;
  thread_ids_json: string;
  created_at: number;
  updated_at: number;
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? undefined,
    priority: row.priority,
    status: row.status,
    tags: JSON.parse(row.tags_json) as string[],
    ownerAgentId: row.owner_agent_id ?? undefined,
    projectPath: row.project_path ?? undefined,
    threadIds: JSON.parse(row.thread_ids_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TaskStore {
  constructor(private readonly db: Database.Database) {}

  create(task: Task): void {
    this.db
      .prepare(
        `INSERT INTO tasks
          (id, title, summary, priority, status, tags_json, owner_agent_id, project_path, thread_ids_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        task.id,
        task.title,
        task.summary ?? null,
        task.priority,
        task.status,
        JSON.stringify(task.tags),
        task.ownerAgentId ?? null,
        task.projectPath ?? null,
        JSON.stringify(task.threadIds),
        task.createdAt,
        task.updatedAt,
      );
  }

  get(id: string): Task | null {
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
    return row ? toTask(row) : null;
  }

  list(limit = 100): Task[] {
    const rows = this.db
      .prepare("SELECT * FROM tasks ORDER BY updated_at DESC LIMIT ?")
      .all(limit) as TaskRow[];
    return rows.map(toTask);
  }

  update(id: string, patch: Partial<Omit<Task, "id" | "createdAt" | "updatedAt" | "threadIds">>): Task | null {
    const existing = this.get(id);
    if (!existing) return null;
    const next: Task = {
      ...existing,
      ...patch,
      tags: patch.tags ?? existing.tags,
      threadIds: existing.threadIds,
    };
    next.updatedAt = Date.now();
    this.db
      .prepare(
        `UPDATE tasks SET title = ?, summary = ?, priority = ?, status = ?, tags_json = ?, owner_agent_id = ?, project_path = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        next.title,
        next.summary ?? null,
        next.priority,
        next.status,
        JSON.stringify(next.tags),
        next.ownerAgentId ?? null,
        next.projectPath ?? null,
        next.updatedAt,
        id,
      );
    return this.get(id);
  }

  /** 追加 threadId 到 task 的 threadIds（去重）。 */
  linkThread(taskId: string, threadId: string): Task | null {
    const existing = this.get(taskId);
    if (!existing) return null;
    if (existing.threadIds.includes(threadId)) return existing;
    const threadIds = [...existing.threadIds, threadId];
    const now = Date.now();
    this.db
      .prepare("UPDATE tasks SET thread_ids_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(threadIds), now, taskId);
    return this.get(taskId);
  }
}
