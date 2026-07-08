"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import type { Agent, AgentRuntimeStatus } from "@the-tower/shared";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { agentAccentClasses } from "@/lib/agentIdentity";
import {
  formatAgentStatusLabel,
  formatRemainingTokens,
  formatTokenUsage,
  formatToolName,
  statusDotClass,
  statusTone,
} from "@/lib/agentStatus";
import { cn } from "@/components/ui/cn";

export interface AgentStatusCardProps {
  agent: Agent;
  status?: AgentRuntimeStatus;
  selectedThreadId?: string;
}

/** Agent 装备卡：只展示运行摘要 + 配置入口，不承载长表单。 */
export function AgentStatusCard({ agent, status, selectedThreadId }: AgentStatusCardProps) {
  const acc = agentAccentClasses(agent.id);
  const runtime: AgentRuntimeStatus = status ?? {
    agentId: agent.id,
    status: "idle",
    updatedAt: 0,
  };
  const tone = statusTone(runtime.status);
  const offThread = Boolean(selectedThreadId && runtime.threadId && runtime.threadId !== selectedThreadId);
  const toolName = formatToolName(runtime.currentToolName);
  const remaining = formatRemainingTokens(runtime.tokenUsage);
  const title = [runtime.detail, runtime.currentToolName].filter(Boolean).join(" · ") || undefined;
  const pulsing = runtime.status !== "idle" && runtime.status !== "error" && runtime.status !== "done";

  return (
    <article
      title={title}
      className={cn(
        "grid gap-1.5 rounded-[var(--radius-tower)] border bg-tower-bg-elevated p-2.5",
        acc.border,
        offThread && "opacity-55",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className={cn("truncate text-[13px] font-bold", acc.text)}>{agent.displayName}</h3>
          <p className="truncate font-mono text-[11px] text-tower-text-muted">{agent.mentionHandles.join(" ")}</p>
        </div>
        <StatusBadge tone={agent.enabled ? tone : "info"}>
          {agent.enabled ? formatAgentStatusLabel(runtime.status) : "off"}
        </StatusBadge>
      </header>
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-[11px]">
        <dt className="text-tower-text-muted">model</dt>
        <dd className="m-0 truncate text-tower-text-secondary">
          {agent.provider}/{agent.model}
        </dd>
        {toolName ? (
          <>
            <dt className="text-tower-text-muted">tool</dt>
            <dd className="m-0 truncate text-tower-accent-solar">{toolName}</dd>
          </>
        ) : null}
        <dt className="text-tower-text-muted">token</dt>
        <dd className="m-0 truncate text-tower-text-secondary">{formatTokenUsage(runtime.tokenUsage)}</dd>
        {remaining ? (
          <>
            <dt className="text-tower-text-muted">left</dt>
            <dd className="m-0 truncate text-tower-text-secondary">{remaining}</dd>
          </>
        ) : null}
      </dl>
      <footer className="flex items-center justify-between">
        <span className={cn("h-2 w-2 rounded-full", statusDotClass(runtime.status), pulsing && "tower-pulse")} />
        <Link
          href={`/agents/${agent.id}`}
          className="inline-flex items-center gap-1 text-[11px] text-tower-text-muted transition-colors hover:text-tower-accent-arc"
        >
          <Settings size={12} />
          Configure
        </Link>
      </footer>
    </article>
  );
}
