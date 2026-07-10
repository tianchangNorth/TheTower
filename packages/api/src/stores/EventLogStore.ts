import type Database from "better-sqlite3";
import type { ServerEvent, TelemetryEventEntry } from "../types.js";

const MAX_EVENT_ROWS = 20_000;

export class EventLogStore {
  constructor(private readonly db: Database.Database) {}

  append(event: ServerEvent, createdAt = Date.now()): number {
    const result = this.db
      .prepare("INSERT INTO event_log (event_json, created_at) VALUES (?, ?)")
      .run(JSON.stringify(event), createdAt);
    const seq = Number(result.lastInsertRowid);
    if (seq % 100 === 0) this.prune();
    return seq;
  }

  listAfter(seq: number, limit = 1_000): TelemetryEventEntry[] {
    const rows = this.db
      .prepare("SELECT seq, event_json FROM event_log WHERE seq > ? ORDER BY seq ASC LIMIT ?")
      .all(seq, limit) as Array<{ seq: number; event_json: string }>;
    return rows.map((row) => ({ seq: row.seq, event: JSON.parse(row.event_json) as ServerEvent }));
  }

  recent(limit = 500): TelemetryEventEntry[] {
    const rows = this.db
      .prepare("SELECT seq, event_json FROM event_log ORDER BY seq DESC LIMIT ?")
      .all(limit) as Array<{ seq: number; event_json: string }>;
    return rows.reverse().map((row) => ({ seq: row.seq, event: JSON.parse(row.event_json) as ServerEvent }));
  }

  private prune(): void {
    this.db
      .prepare("DELETE FROM event_log WHERE seq <= (SELECT COALESCE(MAX(seq) - ?, 0) FROM event_log)")
      .run(MAX_EVENT_ROWS);
  }
}
