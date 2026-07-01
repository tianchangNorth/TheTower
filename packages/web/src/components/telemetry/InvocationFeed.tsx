"use client";

import type { Invocation } from "@the-tower/shared";
import { useTelemetryStore } from "@/stores/telemetryStore";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { FeedState, Empty } from "./FeedState";
import { shortId } from "@/lib/format";

function formatDuration(inv: Invocation): string {
  if (!inv.finishedAt) return "—";
  const d = inv.finishedAt - inv.createdAt;
  return d < 1000 ? `${d}ms` : `${(d / 1000).toFixed(1)}s`;
}

export function InvocationFeed() {
  const invocations = useTelemetryStore((s) => s.invocations);
  const status = useTelemetryStore((s) => s.status.invocations);
  const error = useTelemetryStore((s) => s.error.invocations);

  return (
    <FeedState loading={status === "loading"} error={error}>
      {invocations.length === 0 ? (
        <Empty text="No invocations match filters." />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-2 grid content-start gap-1.5">
          {invocations.map((inv) => {
            const tone =
              inv.status === "running"
                ? "thinking"
                : inv.status === "done"
                  ? "done"
                  : inv.status === "queued"
                    ? "info"
                    : "error";
            return (
              <article
                key={inv.id}
                className="grid gap-1 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated p-2 text-[12px]"
              >
                <header className="flex items-center justify-between gap-2">
                  <strong className="font-mono text-tower-text-primary">{shortId(inv.id)}</strong>
                  <StatusBadge tone={tone}>{inv.status}</StatusBadge>
                </header>
                <dl className="m-0 grid grid-cols-[64px_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-tower-text-secondary">
                  <dt className="text-tower-text-muted">mode</dt>
                  <dd className="m-0 wrap-anywhere">
                    {inv.routeMode ?? (inv.targetAgents.length > 1 ? "fanout" : "single")}
                  </dd>
                  <dt className="text-tower-text-muted">targets</dt>
                  <dd className="m-0 wrap-anywhere">{inv.targetAgents.join(", ") || "(none)"}</dd>
                  <dt className="text-tower-text-muted">started</dt>
                  <dd className="m-0">{new Date(inv.createdAt).toLocaleTimeString()}</dd>
                  <dt className="text-tower-text-muted">dur</dt>
                  <dd className="m-0">{formatDuration(inv)}</dd>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </FeedState>
  );
}
