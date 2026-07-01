"use client";

import Link from "next/link";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { FeedState, Empty } from "@/components/telemetry/FeedState";
import { shortId } from "@/lib/format";

export function ThreadBindings() {
  const threads = useWorkspaceStore((s) => s.threads);
  const status = useWorkspaceStore((s) => s.status);
  const error = useWorkspaceStore((s) => s.error);

  return (
    <HudPanel corner className="min-w-0 flex-1">
      <PanelHeader title="Thread bindings" />
      <FeedState loading={status === "loading"} error={error}>
        {threads.length === 0 ? (
          <Empty text="No threads bound to this workspace." />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-2 grid content-start gap-1.5">
            {threads.map((t) => {
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
                <Link
                  key={t.thread.id}
                  href={`/telemetry/${t.thread.id}`}
                  className="block rounded-[var(--radius-tower)] border border-tower-border-subtle p-2 transition-colors hover:bg-tower-bg-hover"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="truncate text-[13px] font-bold text-tower-text-primary">
                      {t.thread.title}
                    </strong>
                    <StatusBadge tone={t.thread.mode === "play" ? "done" : "info"}>
                      {t.thread.mode ?? "debug"}
                    </StatusBadge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-tower-text-muted">
                    {t.activeAgentIds.length > 0 ? (
                      <StatusBadge tone="thinking">{t.activeAgentIds.length} active</StatusBadge>
                    ) : null}
                    {inv ? <StatusBadge tone={invTone}>{inv.status}</StatusBadge> : null}
                    <span className="font-mono">{shortId(t.thread.id)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </FeedState>
    </HudPanel>
  );
}
