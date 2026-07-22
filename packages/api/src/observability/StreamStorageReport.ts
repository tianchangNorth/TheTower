import type Database from "better-sqlite3";

export interface StreamStorageThresholds {
  maxRowsPerInvocationAgent: number;
  maxPayloadBytesPerInvocationAgent: number;
}

export interface StreamStorageGroup {
  threadId: string;
  invocationId: string;
  senderId: string;
  rowCount: number;
  payloadBytes: number;
  contentBytes: number;
  thinkingBytes: number;
  toolEventCount: number;
}

export interface StreamStorageReport {
  generatedAt: string;
  thresholds: StreamStorageThresholds;
  database: { pageCount: number; pageSize: number; allocatedBytes: number };
  summary: {
    streamRows: number;
    invocationAgentGroups: number;
    payloadBytes: number;
    maxRowsPerGroup: number;
    maxPayloadBytesPerGroup: number;
    p95PayloadBytesPerGroup: number;
  };
  breaches: Array<{
    kind: "row_count" | "payload_bytes";
    threadId: string;
    invocationId: string;
    senderId: string;
    actual: number;
    limit: number;
  }>;
  groups: StreamStorageGroup[];
}

const DEFAULT_THRESHOLDS: StreamStorageThresholds = {
  maxRowsPerInvocationAgent: 1,
  maxPayloadBytesPerInvocationAgent: 1024 * 1024,
};

interface StreamRow {
  thread_id: string;
  invocation_id: string | null;
  sender_id: string | null;
  content: string;
  thinking: string | null;
  tool_events_json: string | null;
  extra_json: string | null;
}

export function observeStreamStorage(
  db: Database.Database,
  thresholds: Partial<StreamStorageThresholds> = {},
): StreamStorageReport {
  const limits: StreamStorageThresholds = {
    maxRowsPerInvocationAgent: thresholds.maxRowsPerInvocationAgent ?? DEFAULT_THRESHOLDS.maxRowsPerInvocationAgent,
    maxPayloadBytesPerInvocationAgent:
      thresholds.maxPayloadBytesPerInvocationAgent ?? DEFAULT_THRESHOLDS.maxPayloadBytesPerInvocationAgent,
  };
  const rows = db
    .prepare(`
      SELECT thread_id, invocation_id, sender_id, content, thinking, tool_events_json, extra_json
      FROM messages
      WHERE origin = 'agent_stream'
      ORDER BY thread_id, invocation_id, sender_id, created_at
    `)
    .all() as StreamRow[];
  const grouped = new Map<string, StreamStorageGroup>();

  for (const row of rows) {
    const invocationId = row.invocation_id ?? "(missing)";
    const senderId = row.sender_id ?? "(missing)";
    const key = `${row.thread_id}\0${invocationId}\0${senderId}`;
    const group = grouped.get(key) ?? {
      threadId: row.thread_id,
      invocationId,
      senderId,
      rowCount: 0,
      payloadBytes: 0,
      contentBytes: 0,
      thinkingBytes: 0,
      toolEventCount: 0,
    };
    const contentBytes = utf8Bytes(row.content);
    const thinkingBytes = utf8Bytes(row.thinking ?? "");
    group.rowCount += 1;
    group.contentBytes += contentBytes;
    group.thinkingBytes += thinkingBytes;
    group.payloadBytes += contentBytes + thinkingBytes + utf8Bytes(row.tool_events_json ?? "") + utf8Bytes(row.extra_json ?? "");
    group.toolEventCount += jsonArrayLength(row.tool_events_json);
    grouped.set(key, group);
  }

  const groups = [...grouped.values()].sort((a, b) => b.payloadBytes - a.payloadBytes);
  const payloadSizes = groups.map((group) => group.payloadBytes).sort((a, b) => a - b);
  const breaches: StreamStorageReport["breaches"] = [];
  for (const group of groups) {
    if (group.rowCount > limits.maxRowsPerInvocationAgent) {
      breaches.push({
        kind: "row_count",
        threadId: group.threadId,
        invocationId: group.invocationId,
        senderId: group.senderId,
        actual: group.rowCount,
        limit: limits.maxRowsPerInvocationAgent,
      });
    }
    if (group.payloadBytes > limits.maxPayloadBytesPerInvocationAgent) {
      breaches.push({
        kind: "payload_bytes",
        threadId: group.threadId,
        invocationId: group.invocationId,
        senderId: group.senderId,
        actual: group.payloadBytes,
        limit: limits.maxPayloadBytesPerInvocationAgent,
      });
    }
  }

  const pageCount = numberPragma(db.pragma("page_count", { simple: true }));
  const pageSize = numberPragma(db.pragma("page_size", { simple: true }));
  return {
    generatedAt: new Date().toISOString(),
    thresholds: limits,
    database: { pageCount, pageSize, allocatedBytes: pageCount * pageSize },
    summary: {
      streamRows: rows.length,
      invocationAgentGroups: groups.length,
      payloadBytes: groups.reduce((sum, group) => sum + group.payloadBytes, 0),
      maxRowsPerGroup: Math.max(0, ...groups.map((group) => group.rowCount)),
      maxPayloadBytesPerGroup: Math.max(0, ...payloadSizes),
      p95PayloadBytesPerGroup: percentile(payloadSizes, 0.95),
    },
    breaches,
    groups,
  };
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function jsonArrayLength(value: string | null): number {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function numberPragma(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}
