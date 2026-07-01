"use client";

import { useTelemetryStore } from "@/stores/telemetryStore";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { FeedState, Empty } from "./FeedState";
import { shortId } from "@/lib/format";

export function ToolAudit() {
  const rows = useTelemetryStore((s) => s.toolAudit);
  const status = useTelemetryStore((s) => s.status.toolAudit);
  const error = useTelemetryStore((s) => s.error.toolAudit);

  return (
    <FeedState loading={status === "loading"} error={error}>
      {rows.length === 0 ? (
        <Empty text="No tool audit rows match filters." />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-2 grid content-start gap-1.5">
          {rows.map((r) => (
            <article
              key={r.seq}
              className="grid gap-1 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated p-2 text-[12px]"
            >
              <header className="flex items-center justify-between gap-2">
                <span className="font-mono text-tower-accent-solar">{r.tool}</span>
                {r.denied ? (
                  <StatusBadge tone="error">denied</StatusBadge>
                ) : (
                  <StatusBadge tone="done">ok</StatusBadge>
                )}
              </header>
              <dl className="m-0 grid grid-cols-[64px_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-tower-text-secondary">
                <dt className="text-tower-text-muted">path</dt>
                <dd className="m-0 wrap-anywhere font-mono">{r.path}</dd>
                <dt className="text-tower-text-muted">agent</dt>
                <dd className="m-0">{r.agentId}</dd>
                <dt className="text-tower-text-muted">inv</dt>
                <dd className="m-0 font-mono">{shortId(r.invocationId)}</dd>
                {r.bytes !== undefined ? (
                  <>
                    <dt className="text-tower-text-muted">bytes</dt>
                    <dd className="m-0">{r.bytes}</dd>
                  </>
                ) : null}
                {r.reason ? (
                  <>
                    <dt className="text-tower-text-muted">reason</dt>
                    <dd className="m-0 wrap-anywhere text-tower-accent-danger">{r.reason}</dd>
                  </>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
      )}
    </FeedState>
  );
}
