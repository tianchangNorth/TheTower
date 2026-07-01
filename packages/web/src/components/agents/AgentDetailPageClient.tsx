"use client";

import { useAgents } from "@/hooks/useAgents";
import { AgentConfigList } from "./AgentConfigList";
import { AgentDetailPanel } from "./AgentDetailPanel";

export function AgentDetailPageClient({ agentId }: { agentId: string }) {
  const { agents } = useAgents();
  return (
    <main className="flex h-full min-h-0 gap-3 bg-tower-bg-base p-3">
      <AgentConfigList agents={agents} selectedAgentId={agentId} />
      <AgentDetailPanel agentId={agentId} />
    </main>
  );
}
