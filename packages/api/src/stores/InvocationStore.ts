import type Database from "better-sqlite3";
import type { Invocation, InvocationStatus } from "../types.js";

interface InvocationRow {
  id: string;
  thread_id: string;
  root_message_id: string;
  status: InvocationStatus;
  target_agents_json: string;
  depth: number;
  created_at: number;
  finished_at: number | null;
}

function toInvocation(row: InvocationRow): Invocation {
  return {
    id: row.id,
    threadId: row.thread_id,
    rootMessageId: row.root_message_id,
    status: row.status,
    targetAgents: JSON.parse(row.target_agents_json) as string[],
    depth: row.depth,
    createdAt: row.created_at,
    finishedAt: row.finished_at ?? undefined,
  };
}

export class InvocationStore {
  constructor(private readonly db: Database.Database) {}

  create(invocation: Invocation): void {
    this.db
      .prepare(
        `
        INSERT INTO invocations (
          id, thread_id, root_message_id, status, target_agents_json, depth, created_at, finished_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        invocation.id,
        invocation.threadId,
        invocation.rootMessageId,
        invocation.status,
        JSON.stringify(invocation.targetAgents),
        invocation.depth,
        invocation.createdAt,
        invocation.finishedAt ?? null,
      );
  }

  get(id: string): Invocation | null {
    const row = this.db.prepare("SELECT * FROM invocations WHERE id = ?").get(id) as InvocationRow | undefined;
    return row ? toInvocation(row) : null;
  }

  updateStatus(id: string, status: InvocationStatus, finishedAt?: number): void {
    this.db
      .prepare("UPDATE invocations SET status = ?, finished_at = COALESCE(?, finished_at) WHERE id = ?")
      .run(status, finishedAt ?? null, id);
  }
}
