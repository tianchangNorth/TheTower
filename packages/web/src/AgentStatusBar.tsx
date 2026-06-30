import type { Agent, AgentRuntimeStatus } from "@the-tower/shared";
import {
  formatAgentStatusLabel,
  formatRemainingTokens,
  formatTokenUsage,
  formatToolName,
  formatUsageDetail,
  statusDotClass,
  statusPillClass,
} from "./statusFormat";

export function AgentStatusBar({
  agents,
  statuses,
  selectedThreadId,
}: {
  agents: Agent[];
  statuses: Record<string, AgentRuntimeStatus>;
  selectedThreadId?: string;
}) {
  const enabledAgents = agents.filter((agent) => agent.enabled);
  if (enabledAgents.length === 0) return null;

  const ordered = [...enabledAgents].sort((left, right) => {
    const leftStatus = statuses[left.id];
    const rightStatus = statuses[right.id];
    const leftActive = isActiveForThread(leftStatus, selectedThreadId);
    const rightActive = isActiveForThread(rightStatus, selectedThreadId);
    if (leftActive !== rightActive) return leftActive ? -1 : 1;
    return left.displayName.localeCompare(right.displayName);
  });

  return (
    <div className="border-b border-[#e1e6e8] bg-[#f8fbfb] px-3 py-2 overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max">
        {ordered.map((agent) => {
          const status = statuses[agent.id] ?? {
            agentId: agent.id,
            status: "idle" as const,
            updatedAt: 0,
          };
          const toolName = formatToolName(status.currentToolName);
          const remaining = formatRemainingTokens(status.tokenUsage);
          const usageDetail = formatUsageDetail(status.tokenUsage);
          const offThread = Boolean(selectedThreadId && status.threadId && status.threadId !== selectedThreadId);
          const title = [status.detail, status.currentToolName, usageDetail].filter(Boolean).join(" · ") || undefined;
          return (
            <div
              key={agent.id}
              className={[
                "min-h-9 inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px] whitespace-nowrap",
                statusPillClass(status.status),
                offThread ? "opacity-55" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title={title}
            >
              <span className={`h-2 w-2 rounded-full ${statusDotClass(status.status)}`} />
              <span className="font-semibold text-[#1d2b2f]">{agent.displayName}</span>
              <span className="text-[#516064]">{formatAgentStatusLabel(status.status)}</span>
              {toolName ? <span className="text-[#7b5b19]">{toolName}</span> : null}
              <span className="text-[#667477]">{formatTokenUsage(status.tokenUsage)}</span>
              {usageDetail ? <span className="text-[#667477]">{usageDetail}</span> : null}
              {remaining ? <span className="text-[#667477]">{remaining}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function isActiveForThread(status: AgentRuntimeStatus | undefined, selectedThreadId: string | undefined): boolean {
  if (!status || status.status === "idle") return false;
  if (!selectedThreadId) return true;
  return status.threadId === selectedThreadId;
}
