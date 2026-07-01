"use client";

import { useTelemetryStore } from "@/stores/telemetryStore";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { FeedState, Empty } from "./FeedState";
import { cn } from "@/components/ui/cn";
import type { TelemetryUrlFilters } from "@/lib/telemetry";

export function ThreadTimeline({
  filters,
  selectedThreadId,
  onSelect,
}: {
  filters: TelemetryUrlFilters;
  selectedThreadId?: string;
  onSelect: (threadId: string) => void;
}) {
  const threads = useTelemetryStore((s) => s.threads);
  const status = useTelemetryStore((s) => s.status.threads);
  const error = useTelemetryStore((s) => s.error.threads);

  const ws = filters.workspace?.trim().toLowerCase();
  const filtered = ws
    ? threads.filter(
        (t) =>
          (t.workspaceLabel ?? "").toLowerCase().includes(ws) ||
          (t.projectPath ?? "").toLowerCase().includes(ws),
      )
    : threads;

  return (
    <HudPanel corner className="w-[300px] shrink-0">
      <PanelHeader title="Thread timeline" />
      <FeedState loading={status === "loading"} error={error}>
        {filtered.length === 0 ? (
          <Empty text="No threads." />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-2 grid content-start gap-1.5">
            {filtered.map((t) => {
              const inv = t.latestInvocation;
              const invTone =
                inv?.status === "running"
                  ? "thinking"
                  : inv?.status === "done"
                    ? "done"
                    : inv?.status === "queued"
                      ? "info"
                      : "error";
              return (
                <button
                  key={t.thread.id}
                  type="button"
                  onClick={() => onSelect(t.thread.id)}
                  className={cn(
                    "block w-full rounded-[var(--radius-tower)] border p-2 text-left transition-colors hover:bg-tower-bg-hover",
                    selectedThreadId === t.thread.id
                      ? "border-tower-border-energy bg-tower-accent-arc/10"
                      : "border-transparent",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-bold text-tower-text-primary">
                      {t.thread.title}
                    </span>
                    {t.errorCount > 0 ? (
                      <StatusBadge tone="error">{t.errorCount} err</StatusBadge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-tower-text-muted">
                    <span className="truncate">{t.workspaceLabel ?? "No workspace"}</span>
                    {t.activeAgentIds.length > 0 ? (
                      <StatusBadge tone="thinking">{t.activeAgentIds.length} active</StatusBadge>
                    ) : null}
                    {inv ? <StatusBadge tone={invTone}>{inv.status}</StatusBadge> : null}
                    <span className="ml-auto">{t.messageCount} msg</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </FeedState>
    </HudPanel>
  );
}
