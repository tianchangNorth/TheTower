import type { InvocationStatus } from "@the-tower/shared";

export interface TelemetryUrlFilters {
  threadId?: string;
  agentId?: string;
  status?: InvocationStatus;
  eventType?: string;
  workspace?: string;
  from?: number;
  to?: number;
}

export const EVENT_TYPES = [
  "message.created",
  "message.updated",
  "invocation.updated",
  "agent.status",
  "agent.token_usage",
  "agent.liveness",
  "workspace.resolved",
  "workspace.file_tool",
  "worklist.updated",
  "agent.event",
  "callback.write",
] as const;

export const INVOCATION_STATUSES: InvocationStatus[] = [
  "queued",
  "running",
  "done",
  "failed",
  "cancelled",
];
