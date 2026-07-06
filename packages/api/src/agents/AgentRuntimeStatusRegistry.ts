import type {
  AgentLivenessSnapshot,
  AgentRuntimeStatus,
  AgentTokenUsage,
  AgentWorkStatus,
} from "../types.js";

export interface AgentRuntimeStatusInput {
  agentId: string;
  threadId?: string;
  invocationId?: string;
  detail?: string;
}

export class AgentRuntimeStatusRegistry {
  private readonly statuses = new Map<string, AgentRuntimeStatus>();

  markSessionStarted(input: AgentRuntimeStatusInput & { startedAt?: number }): AgentRuntimeStatus {
    const now = Date.now();
    return this.setSnapshot(input.agentId, {
      ...this.statuses.get(input.agentId),
      agentId: input.agentId,
      threadId: input.threadId,
      invocationId: input.invocationId,
      status: "thinking",
      detail: input.detail,
      currentToolName: undefined,
      startedAt: input.startedAt ?? now,
      lastEventAt: now,
      lastToolAt: undefined,
      lastTextAt: undefined,
      updatedAt: now,
      tokenUsage: undefined,
      liveness: undefined,
    });
  }

  setStatus(
    input: AgentRuntimeStatusInput & {
      status: AgentWorkStatus;
      currentToolName?: string;
    },
  ): AgentRuntimeStatus {
    const now = Date.now();
    const existing = this.statuses.get(input.agentId);
    return this.setSnapshot(input.agentId, {
      ...existing,
      agentId: input.agentId,
      threadId: input.threadId ?? existing?.threadId,
      invocationId: input.invocationId ?? existing?.invocationId,
      status: input.status,
      detail: input.detail,
      currentToolName: input.currentToolName,
      // A real event (or terminal state) arriving via setStatus means the agent is
      // no longer silent — clear any stale liveness snapshot set by setLiveness.
      // setLiveness is the only path that populates liveness; it never routes
      // through setStatus, so clearing here is always correct.
      liveness: undefined,
      lastEventAt: now,
      lastToolAt: input.status === "tool_calling" ? now : existing?.lastToolAt,
      lastTextAt: input.status === "replying" ? now : existing?.lastTextAt,
      updatedAt: now,
    });
  }

  setTokenUsage(input: AgentRuntimeStatusInput & { usage: AgentTokenUsage }): AgentRuntimeStatus {
    const now = Date.now();
    const existing = this.statuses.get(input.agentId);
    const tokenUsage = mergeAgentTokenUsage(existing?.tokenUsage, input.usage);
    return this.setSnapshot(input.agentId, {
      ...existing,
      agentId: input.agentId,
      threadId: input.threadId ?? existing?.threadId,
      invocationId: input.invocationId ?? existing?.invocationId,
      status: existing?.status ?? "idle",
      detail: input.detail ?? existing?.detail,
      tokenUsage,
      lastEventAt: now,
      updatedAt: now,
    });
  }

  setLiveness(input: AgentRuntimeStatusInput & { liveness: AgentLivenessSnapshot }): AgentRuntimeStatus {
    const existing = this.statuses.get(input.agentId);
    const status: AgentWorkStatus =
      input.liveness.state === "busy_silent" || input.liveness.state === "idle_silent"
        ? "alive_but_silent"
        : input.liveness.state === "dead"
          ? "error"
          : existing?.status ?? "idle";
    return this.setSnapshot(input.agentId, {
      ...existing,
      agentId: input.agentId,
      threadId: input.threadId ?? existing?.threadId,
      invocationId: input.invocationId ?? existing?.invocationId,
      status,
      detail: input.detail ?? existing?.detail,
      liveness: input.liveness,
      updatedAt: input.liveness.checkedAt,
    });
  }

  markSessionCompleted(
    input: AgentRuntimeStatusInput & { status?: Extract<AgentWorkStatus, "done" | "error" | "idle"> },
  ): AgentRuntimeStatus {
    return this.setStatus({
      ...input,
      status: input.status ?? "done",
      currentToolName: undefined,
    });
  }

  clearInvocation(invocationId: string): AgentRuntimeStatus[] {
    const updated: AgentRuntimeStatus[] = [];
    for (const status of this.statuses.values()) {
      if (status.invocationId !== invocationId) continue;
      updated.push(
        this.setStatus({
          agentId: status.agentId,
          threadId: status.threadId,
          invocationId,
          status: "idle",
          detail: undefined,
        }),
      );
    }
    return updated;
  }

  get(agentId: string): AgentRuntimeStatus | undefined {
    return this.statuses.get(agentId);
  }

  list(): AgentRuntimeStatus[] {
    return [...this.statuses.values()].sort(compareStatus);
  }

  listByThread(threadId: string): AgentRuntimeStatus[] {
    return this.list().filter((status) => status.threadId === threadId);
  }

  private setSnapshot(agentId: string, status: AgentRuntimeStatus): AgentRuntimeStatus {
    this.statuses.set(agentId, status);
    return status;
  }
}

export function mergeAgentTokenUsage(
  existing: AgentTokenUsage | undefined,
  incoming: AgentTokenUsage,
): AgentTokenUsage {
  const result: AgentTokenUsage = existing ? { ...existing } : { source: incoming.source };
  const aggregateKeys = [
    "inputTokens",
    "outputTokens",
    "reasoningTokens",
    "cacheReadTokens",
    "cacheCreationTokens",
    "totalTokens",
    "costUsd",
    "durationMs",
    "durationApiMs",
    "numTurns",
  ] as const;
  for (const key of aggregateKeys) {
    const value = incoming[key];
    if (value !== undefined) result[key] = ((result[key] ?? 0) as number) + value;
  }

  if (incoming.contextWindowSize !== undefined) result.contextWindowSize = incoming.contextWindowSize;
  if (incoming.lastTurnInputTokens !== undefined) result.lastTurnInputTokens = incoming.lastTurnInputTokens;
  if (incoming.contextUsedTokens !== undefined) result.contextUsedTokens = incoming.contextUsedTokens;
  if (incoming.contextResetsAtMs !== undefined) result.contextResetsAtMs = incoming.contextResetsAtMs;
  if (incoming.budgetTokens !== undefined) result.budgetTokens = incoming.budgetTokens;
  if (incoming.isCumulativeUsage !== undefined) result.isCumulativeUsage = incoming.isCumulativeUsage;
  if (incoming.costEstimated !== undefined) result.costEstimated = incoming.costEstimated;

  if (incoming.source !== "unavailable" || !existing) result.source = incoming.source;
  return normalizeUsage(result);
}

function normalizeUsage(usage: AgentTokenUsage): AgentTokenUsage {
  const totalTokens = usage.totalTokens ?? sumDefined(usage.inputTokens, usage.outputTokens, usage.reasoningTokens);
  const usedForRemaining = resolveContextUsedTokens(usage);
  const remainingTokens =
    usage.remainingTokens ??
    (usage.budgetTokens !== undefined && usedForRemaining !== undefined
      ? Math.max(usage.budgetTokens - usedForRemaining, 0)
      : undefined);
  return {
    ...usage,
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(remainingTokens !== undefined ? { remainingTokens } : {}),
  };
}

function resolveContextUsedTokens(usage: AgentTokenUsage): number | undefined {
  if (usage.contextUsedTokens !== undefined) return usage.contextUsedTokens;
  if (
    usage.lastTurnInputTokens !== undefined &&
    usage.contextWindowSize !== undefined &&
    usage.lastTurnInputTokens <= usage.contextWindowSize
  ) {
    return usage.lastTurnInputTokens;
  }
  if (usage.isCumulativeUsage) return undefined;
  if (
    usage.inputTokens !== undefined &&
    usage.contextWindowSize !== undefined &&
    usage.inputTokens <= usage.contextWindowSize
  ) {
    return usage.inputTokens;
  }
  return undefined;
}

function sumDefined(...values: Array<number | undefined>): number | undefined {
  const present = values.filter((value): value is number => value !== undefined);
  if (present.length === 0) return undefined;
  return present.reduce((sum, value) => sum + value, 0);
}

function compareStatus(left: AgentRuntimeStatus, right: AgentRuntimeStatus): number {
  return left.agentId.localeCompare(right.agentId);
}
