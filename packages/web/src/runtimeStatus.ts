import type { AgentRuntimeStatus } from "@the-tower/shared";

export type AgentRuntimeStatusMap = Record<string, AgentRuntimeStatus>;

export function hydrateRuntimeStatuses(statuses: AgentRuntimeStatus[]): AgentRuntimeStatusMap {
  const next: AgentRuntimeStatusMap = {};
  for (const status of statuses) next[status.agentId] = status;
  return next;
}

export function applyRuntimeStatusSnapshot(
  statuses: AgentRuntimeStatusMap,
  status: AgentRuntimeStatus,
): AgentRuntimeStatusMap {
  return {
    ...statuses,
    [status.agentId]: status,
  };
}
