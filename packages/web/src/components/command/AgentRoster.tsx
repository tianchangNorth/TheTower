"use client";

import type { Agent, AgentRuntimeStatus } from "@the-tower/shared";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { AgentStatusCard } from "./AgentStatusCard";

export interface AgentRosterProps {
  agents: Agent[];
  statuses: Record<string, AgentRuntimeStatus>;
  selectedThreadId?: string;
}

export function AgentRoster({ agents, statuses, selectedThreadId }: AgentRosterProps) {
  return (
    <HudPanel corner className="w-[280px] shrink-0">
      <PanelHeader title="Agents" />
      <div className="min-h-0 flex-1 overflow-auto p-2.5 grid content-start gap-2">
        {agents.length === 0 ? (
          <p className="m-auto text-[12px] text-tower-text-muted">No agents.</p>
        ) : (
          agents.map((agent) => (
            <AgentStatusCard
              key={agent.id}
              agent={agent}
              status={statuses[agent.id]}
              selectedThreadId={selectedThreadId}
            />
          ))
        )}
      </div>
    </HudPanel>
  );
}
