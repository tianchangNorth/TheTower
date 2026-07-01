import type { AgentRuntimeStatus, ServerEvent } from "@the-tower/shared";

// ServerEvent 现为共享契约（@the-tower/shared），SSE 与 Telemetry 查询共用。
export type { ServerEvent };

export type AppPage = "command" | "agents" | "telemetry" | "workspaces" | "tasks" | "settings";

export interface EventLogItem {
  id: number;
  receivedAt: number;
  event: ServerEvent;
}

export type MessageAuditFilter = "all" | "private" | "callback" | "privateCallback" | "revealed" | "handoff";

export const messageAuditFilters: Array<{ id: MessageAuditFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "private", label: "Private" },
  { id: "callback", label: "Callback" },
  { id: "privateCallback", label: "Private callback" },
  { id: "revealed", label: "Revealed" },
  { id: "handoff", label: "Handoff" },
];
