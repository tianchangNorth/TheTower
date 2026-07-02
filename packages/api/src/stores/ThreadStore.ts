import type Database from "better-sqlite3";
import type { Thread, ThreadMode } from "../types.js";

interface ThreadRow {
  id: string;
  title: string;
  mode: ThreadMode | null;
  project_path: string | null;
  created_at: number;
  updated_at: number;
}

function toThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    title: row.title,
    mode: row.mode ?? "play",
    projectPath: row.project_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ThreadStore {
  constructor(private readonly db: Database.Database) {}

  create(thread: Thread): void {
    this.db
      .prepare(
        `
        INSERT INTO threads (id, title, mode, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
      .run(thread.id, thread.title, thread.mode ?? "play", normalizeProjectPath(thread.projectPath), thread.createdAt, thread.updatedAt);
  }

  get(id: string): Thread | null {
    const row = this.db.prepare("SELECT * FROM threads WHERE id = ?").get(id) as ThreadRow | undefined;
    return row ? toThread(row) : null;
  }

  list(limit = 50): Thread[] {
    const rows = this.db
      .prepare("SELECT * FROM threads ORDER BY updated_at DESC LIMIT ?")
      .all(limit) as ThreadRow[];
    return rows.map(toThread);
  }

  touch(id: string, updatedAt: number): void {
    this.db.prepare("UPDATE threads SET updated_at = ? WHERE id = ?").run(updatedAt, id);
  }

  updateMode(id: string, mode: ThreadMode): Thread | null {
    const now = Date.now();
    this.db.prepare("UPDATE threads SET mode = ?, updated_at = ? WHERE id = ?").run(mode, now, id);
    return this.get(id);
  }

  update(id: string, patch: { mode?: ThreadMode; projectPath?: string | null }): Thread | null {
    const existing = this.get(id);
    if (!existing) return null;
    const now = Date.now();
    this.db
      .prepare("UPDATE threads SET mode = ?, project_path = ?, updated_at = ? WHERE id = ?")
      .run(
        patch.mode ?? existing.mode ?? "play",
        patch.projectPath === undefined ? normalizeProjectPath(existing.projectPath) : normalizeProjectPath(patch.projectPath),
        now,
        id,
      );
    return this.get(id);
  }

  updateProjectPath(id: string, projectPath: string | null): Thread | null {
    return this.update(id, { projectPath });
  }

  delete(id: string): boolean {
    const existing = this.get(id);
    if (!existing) return false;
    const cascade = this.db.transaction(() => {
      // FK enforcement is ON (db/database.ts) and schema has no ON DELETE CASCADE,
      // so delete dependents in FK order before the thread itself.
      this.db
        .prepare("DELETE FROM callback_tokens WHERE invocation_id IN (SELECT id FROM invocations WHERE thread_id = ?)")
        .run(id);
      this.db.prepare("DELETE FROM invocations WHERE thread_id = ?").run(id);
      this.db.prepare("DELETE FROM messages WHERE thread_id = ?").run(id);
      this.db.prepare("DELETE FROM threads WHERE id = ?").run(id);
    });
    cascade();
    return true;
  }
}

function normalizeProjectPath(value: string | null | undefined): string | null {
  if (value === null) return null;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
