import type Database from "better-sqlite3";
import type { Thread } from "../types.js";

interface ThreadRow {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

function toThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    title: row.title,
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
        INSERT INTO threads (id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `,
      )
      .run(thread.id, thread.title, thread.createdAt, thread.updatedAt);
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
}
