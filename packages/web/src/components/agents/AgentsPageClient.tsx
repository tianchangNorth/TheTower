"use client";

import { useAgents } from "@/hooks/useAgents";
import { HudPanel } from "@/components/hud/HudPanel";
import { AgentConfigList } from "./AgentConfigList";

export function AgentsPageClient() {
  const { agents } = useAgents();
  return (
    <main className="flex h-full min-h-0 gap-3 bg-tower-bg-base p-3">
      <AgentConfigList agents={agents} />
      <HudPanel className="min-w-0 flex-1">
        <p className="m-auto text-[12px] text-tower-text-muted">
          从左侧选择 Agent 查看与编辑配置。
        </p>
      </HudPanel>
    </main>
  );
}
