"use client";

import { useCallback } from "react";
import { useAgentConfig } from "@/hooks/useAgentConfig";
import { HudPanel } from "@/components/hud/HudPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AgentConfigHeader } from "./AgentConfigHeader";
import { OverviewTab } from "./OverviewTab";
import { PersonaTab } from "./PersonaTab";
import { ModelTab } from "./ModelTab";
import { ToolsTab } from "./ToolsTab";
import { RuntimeTab } from "./RuntimeTab";
import { AuditTab } from "./AuditTab";
import { isDraftDirty } from "@/stores/agentConfigStore";

export function AgentDetailPanel({ agentId }: { agentId: string }) {
  const { entry, status, error, loading, fetchError, tools, runtime, audit, refresh, save, patch } =
    useAgentConfig(agentId);

  const handleSave = useCallback(async () => {
    if (!entry) return;
    const w = entry.working;
    try {
      await save({
        displayName: w.displayName,
        mentionHandles: w.mentionHandles,
        provider: w.provider,
        model: w.model,
        persona: w.persona,
        enabled: w.enabled,
      });
    } catch {
      // error 已写入 store
    }
  }, [entry, save]);

  if (loading && !entry) {
    return (
      <HudPanel className="min-w-0 flex-1">
        <p className="m-auto text-[12px] text-tower-text-muted">Loading agent…</p>
      </HudPanel>
    );
  }
  if (fetchError || !entry) {
    return (
      <HudPanel className="min-w-0 flex-1">
        <p className="m-auto text-[12px] text-tower-accent-danger">{fetchError ?? "agent not found"}</p>
      </HudPanel>
    );
  }

  const dirty = isDraftDirty(entry);
  return (
    <HudPanel accent className="min-w-0 flex-1">
      <AgentConfigHeader
        agent={entry.working}
        dirty={dirty}
        status={status}
        error={error}
        onSave={() => void handleSave()}
        onReload={() => void refresh()}
      />
      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        <TabsList className="self-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="persona">Persona</TabsTrigger>
          <TabsTrigger value="model">Model</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="runtime">Runtime</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab agent={entry.working} agentId={agentId} onPatch={patch} />
        </TabsContent>
        <TabsContent value="persona">
          <PersonaTab agent={entry.working} agentId={agentId} onPatch={patch} />
        </TabsContent>
        <TabsContent value="model">
          <ModelTab agent={entry.working} agentId={agentId} onPatch={patch} />
        </TabsContent>
        <TabsContent value="tools">
          <ToolsTab data={tools} />
        </TabsContent>
        <TabsContent value="runtime">
          <RuntimeTab data={runtime} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab data={audit} />
        </TabsContent>
      </Tabs>
    </HudPanel>
  );
}
