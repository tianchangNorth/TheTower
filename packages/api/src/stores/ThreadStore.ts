import type Database from "better-sqlite3";
import type { Thread, ThreadMode } from "../types.js";

interface ThreadRow {
  id: string;
  title: string;
  mode: ThreadMode | null;
  created_at: number;
  updated_at: number;
}

function toThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    title: row.title,
    mode: row.mode ?? "debug",
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
        INSERT INTO threads (id, title, mode, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      )
      .run(thread.id, thread.title, thread.mode ?? "debug", thread.createdAt, thread.updatedAt);
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
}
