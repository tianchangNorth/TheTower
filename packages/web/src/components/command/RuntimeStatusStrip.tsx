"use client";

import type { Agent, AgentRuntimeStatus, AgentWorkStatus } from "@the-tower/shared";
import { cn } from "@/components/ui/cn";
import {
  formatAgentStatusLabel,
  formatRemainingTokens,
  formatTokenUsage,
  formatToolName,
  formatUsageDetail,
  statusDotClass,
} from "@/lib/agentStatus";

export interface RuntimeStatusStripProps {
  agents: Agent[];
  statuses: Record<string, AgentRuntimeStatus>;
  selectedThreadId?: string;
}

function isActiveForThread(status: AgentRuntimeStatus | undefined, selectedThreadId: string | undefined): boolean {
  if (!status || status.status === "idle") return false;
  if (!selectedThreadId) return true;
  return status.threadId === selectedThreadId;
}

/** Agent 运行状态条：当前任务链路、活跃 Agent、当前工具、token。 */
export function RuntimeStatusStrip({ agents, statuses, selectedThreadId }: RuntimeStatusStripProps) {
  const enabled = agents.filter((agent) => agent.enabled);
  if (enabled.length === 0) return null;
  const ordered = [...enabled].sort((left, right) => {
    const leftActive = isActiveForThread(statuses[left.id], selectedThreadId);
    const rightActive = isActiveForThread(statuses[right.id], selectedThreadId);
    if (leftActive !== rightActive) return leftActive ? -1 : 1;
    return left.displayName.localeCompare(right.displayName);
  });

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-tower-border-subtle bg-tower-bg-elevated px-3 py-2">
      <div className="flex min-w-max items-center gap-2">
        {ordered.map((agent) => {
          const status = statuses[agent.id] ?? {
            agentId: agent.id,
            status: "idle" as AgentWorkStatus,
            updatedAt: 0,
          };
          const toolName = formatToolName(status.currentToolName);
          const remaining = formatRemainingTokens(status.tokenUsage);
          const usageDetail = formatUsageDetail(status.tokenUsage);
          const offThread = Boolean(selectedThreadId && status.threadId && status.threadId !== selectedThreadId);
          const pulsing = status.status !== "idle" && status.status !== "error" && status.status !== "done";
          const title =
            [status.detail, status.currentToolName, usageDetail].filter(Boolean).join(" · ") || undefined;
          return (
            <div
              key={agent.id}
              title={title}
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-panel px-2.5 py-1.5 text-[12px] whitespace-nowrap",
                offThread && "opacity-55",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", statusDotClass(status.status), pulsing && "tower-pulse")} />
              <span className="font-semibold text-tower-text-primary">{agent.displayName}</span>
              <span className="text-tower-text-secondary">{formatAgentStatusLabel(status.status)}</span>
              {toolName ? <span className="text-tower-accent-solar">{toolName}</span> : null}
              <span className="text-tower-text-muted">{formatTokenUsage(status.tokenUsage)}</span>
              {remaining ? <span className="text-tower-text-muted">{remaining}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
