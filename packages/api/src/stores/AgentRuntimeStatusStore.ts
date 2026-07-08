import type Database from "better-sqlite3";
import type { AgentRuntimeStatus } from "../types.js";

interface AgentRuntimeStatusRow {
  agent_id: string;
  thread_id: string | null;
  invocation_id: string | null;
  status: AgentRuntimeStatus["status"];
  updated_at: number;
  status_json: string;
}

export class AgentRuntimeStatusStore {
  constructor(private readonly db: Database.Database) {}

  upsert(status: AgentRuntimeStatus): void {
    this.db
      .prepare(
        `
        INSERT INTO agent_runtime_statuses (
          agent_id, thread_id, invocation_id, status, updated_at, status_json
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(agent_id) DO UPDATE SET
          thread_id = excluded.thread_id,
          invocation_id = excluded.invocation_id,
          status = excluded.status,
          updated_at = excluded.updated_at,
          status_json = excluded.status_json
      `,
      )
      .run(
        status.agentId,
        status.threadId ?? null,
        status.invocationId ?? null,
        status.status,
        status.updatedAt,
        JSON.stringify(status),
      );
  }

  list(): AgentRuntimeStatus[] {
    const rows = this.db
      .prepare("SELECT agent_id, thread_id, invocation_id, status, updated_at, status_json FROM agent_runtime_statuses ORDER BY updated_at DESC")
      .all() as AgentRuntimeStatusRow[];
    return rows.map(toRuntimeStatus).filter((status): status is AgentRuntimeStatus => Boolean(status));
  }
}

function toRuntimeStatus(row: AgentRuntimeStatusRow): AgentRuntimeStatus | undefined {
  try {
    const parsed = JSON.parse(row.status_json) as AgentRuntimeStatus;
    return {
      ...parsed,
      agentId: row.agent_id,
      threadId: row.thread_id ?? undefined,
      invocationId: row.invocation_id ?? undefined,
      status: row.status,
      updatedAt: row.updated_at,
    };
  } catch {
    return undefined;
  }
}
