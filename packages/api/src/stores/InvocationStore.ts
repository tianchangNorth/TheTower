import type Database from "better-sqlite3";
import type { A2ARouteMode, Invocation, InvocationStatus } from "../types.js";

interface InvocationRow {
  id: string;
  thread_id: string;
  root_message_id: string;
  status: InvocationStatus;
  target_agents_json: string;
  route_mode: A2ARouteMode | null;
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
    routeMode: row.route_mode ?? undefined,
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
          id, thread_id, root_message_id, status, target_agents_json, route_mode, depth, created_at, finished_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        invocation.id,
        invocation.threadId,
        invocation.rootMessageId,
        invocation.status,
        JSON.stringify(invocation.targetAgents),
        invocation.routeMode ?? null,
        invocation.depth,
        invocation.createdAt,
        invocation.finishedAt ?? null,
      );
  }

  get(id: string): Invocation | null {
    const row = this.db.prepare("SELECT * FROM invocations WHERE id = ?").get(id) as InvocationRow | undefined;
    return row ? toInvocation(row) : null;
  }

  listByThread(threadId: string, limit = 50): Invocation[] {
    const rows = this.db
      .prepare("SELECT * FROM invocations WHERE thread_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(threadId, limit) as InvocationRow[];
    return rows.map(toInvocation);
  }

  /** 跨线程查询，支持 threadId / status / from / to 过滤；agentId 在 JS 层过滤 targetAgents。 */
  list(filter: {
    threadId?: string;
    status?: InvocationStatus;
    agentId?: string;
    from?: number;
    to?: number;
    limit?: number;
  } = {}): Invocation[] {
    const where: string[] = [];
    const params: Array<string | number> = [];
    if (filter.threadId) {
      where.push("thread_id = ?");
      params.push(filter.threadId);
    }
    if (filter.status) {
      where.push("status = ?");
      params.push(filter.status);
    }
    if (filter.from !== undefined) {
      where.push("created_at >= ?");
      params.push(filter.from);
    }
    if (filter.to !== undefined) {
      where.push("created_at <= ?");
      params.push(filter.to);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const limit = filter.limit ?? 200;
    const rows = this.db
      .prepare(`SELECT * FROM invocations ${clause} ORDER BY created_at DESC LIMIT ?`)
      .all(...params, limit) as InvocationRow[];
    const mapped = rows.map(toInvocation);
    return filter.agentId
      ? mapped.filter((invocation) => invocation.targetAgents.includes(filter.agentId as string))
      : mapped;
  }

  updateStatus(id: string, status: InvocationStatus, finishedAt?: number): void {
    this.db
      .prepare("UPDATE invocations SET status = ?, finished_at = COALESCE(?, finished_at) WHERE id = ?")
      .run(status, finishedAt ?? null, id);
  }
}
