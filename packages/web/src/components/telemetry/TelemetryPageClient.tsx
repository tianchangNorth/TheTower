"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { InvocationStatus } from "@the-tower/shared";
import type { TelemetryQueryParams } from "@the-tower/sdk";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useThreadContext } from "@/hooks/useThreadContext";
import { TelemetryHeader } from "./TelemetryHeader";
import { TelemetryFilters } from "./TelemetryFilters";
import { ThreadTimeline } from "./ThreadTimeline";
import { InvocationFeed } from "./InvocationFeed";
import { EventFeed } from "./EventFeed";
import { ToolAudit } from "./ToolAudit";
import { ThreadContextPanel } from "./ThreadContextPanel";
import { RawMessagesPanel } from "./RawMessagesPanel";
import { AgentContextPanel } from "./AgentContextPanel";
import { HudPanel } from "@/components/hud/HudPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { type TelemetryUrlFilters } from "@/lib/telemetry";

export function TelemetryPageClient({ threadId: pathThreadId }: { threadId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters: TelemetryUrlFilters = useMemo(() => {
    const statusParam = searchParams.get("status") || undefined;
    return {
      threadId: pathThreadId ?? searchParams.get("threadId") ?? undefined,
      agentId: searchParams.get("agentId") ?? undefined,
      status: (statusParam ?? undefined) as InvocationStatus | undefined,
      eventType: searchParams.get("eventType") ?? undefined,
      workspace: searchParams.get("workspace") ?? undefined,
      from: searchParams.get("from") ? Number(searchParams.get("from")) : undefined,
      to: searchParams.get("to") ? Number(searchParams.get("to")) : undefined,
    };
  }, [pathThreadId, searchParams]);

  const query: TelemetryQueryParams = useMemo(
    () => ({
      threadId: filters.threadId,
      agentId: filters.agentId,
      status: filters.status,
      type: filters.eventType,
      from: filters.from,
      to: filters.to,
    }),
    [filters],
  );

  const { refresh } = useTelemetry(query);
  const selectedThreadId = filters.threadId;
  const { context, loading, error } = useThreadContext(selectedThreadId);

  const applyFilters = useCallback(
    (patch: Partial<TelemetryUrlFilters>) => {
      const params = new URLSearchParams(searchParams.toString());
      const merged = { ...filters, ...patch };
      (["agentId", "status", "eventType", "workspace", "from", "to"] as const).forEach((k) => {
        const v = merged[k];
        if (v === undefined || v === "") params.delete(k);
        else params.set(k, String(v));
      });
      const qs = params.toString();
      router.replace(`/telemetry${qs ? `?${qs}` : ""}`);
    },
    [router, searchParams, filters],
  );

  const handleSelect = useCallback(
    (threadId: string) => {
      const qs = searchParams.toString();
      router.push(`/telemetry/${threadId}${qs ? `?${qs}` : ""}`);
    },
    [router, searchParams],
  );

  return (
    <main className="flex h-full min-h-0 flex-col bg-tower-bg-base">
      <TelemetryHeader onRefresh={() => void refresh()} capability="live_only" />
      <TelemetryFilters value={filters} onChange={applyFilters} />
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <ThreadTimeline
          filters={filters}
          selectedThreadId={selectedThreadId}
          onSelect={handleSelect}
        />
        <HudPanel accent className="min-w-0 flex-1">
          <Tabs defaultValue="invocations" className="flex min-h-0 flex-1 flex-col gap-2 p-2">
            <TabsList className="self-start">
              <TabsTrigger value="invocations">Invocations</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="tool-audit">Tool audit</TabsTrigger>
              <TabsTrigger value="raw-messages">Raw messages</TabsTrigger>
              <TabsTrigger value="agent-context">Agent context</TabsTrigger>
            </TabsList>
            <TabsContent value="invocations" className="flex min-h-0 flex-1 flex-col">
              <InvocationFeed />
            </TabsContent>
            <TabsContent value="events" className="flex min-h-0 flex-1 flex-col">
              <EventFeed />
            </TabsContent>
            <TabsContent value="tool-audit" className="flex min-h-0 flex-1 flex-col">
              <ToolAudit workspaceFilter={filters.workspace} />
            </TabsContent>
            <TabsContent value="raw-messages" className="flex min-h-0 flex-1 flex-col">
              <RawMessagesPanel threadId={selectedThreadId} />
            </TabsContent>
            <TabsContent value="agent-context" className="flex min-h-0 flex-1 flex-col">
              <AgentContextPanel threadId={selectedThreadId} />
            </TabsContent>
          </Tabs>
        </HudPanel>
        <ThreadContextPanel
          threadId={selectedThreadId}
          context={context}
          loading={loading}
          error={error}
        />
      </div>
    </main>
  );
}
