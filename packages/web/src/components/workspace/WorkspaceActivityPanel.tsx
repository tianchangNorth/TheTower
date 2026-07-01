"use client";

import { useWorkspaceStore } from "@/stores/workspaceStore";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { FeedState, Empty } from "@/components/telemetry/FeedState";
import { shortId } from "@/lib/format";
import { cn } from "@/components/ui/cn";

/** 最近文件工具访问：read/write/list、denied reason、bytes、agent、invocation、time。 */
export function WorkspaceActivityPanel() {
  const rows = useWorkspaceStore((s) => s.activity);
  const status = useWorkspaceStore((s) => s.status);
  const error = useWorkspaceStore((s) => s.error);

  return (
    <HudPanel corner className="min-w-0 flex-1">
      <PanelHeader
        title="Workspace activity"
        action={<StatusBadge tone="info">live_only</StatusBadge>}
      />
      <FeedState loading={status === "loading"} error={error}>
        {rows.length === 0 ? (
          <Empty text="No recent file tool access." />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-2 grid content-start gap-1.5">
            {rows.map((r) => (
              <article
                key={r.seq}
                className={cn(
                  "grid gap-1 rounded-[var(--radius-tower)] border p-2 text-[12px]",
                  r.denied
                    ? "border-tower-accent-danger/50 bg-tower-accent-danger/10"
                    : "border-tower-border-subtle bg-tower-bg-elevated",
                )}
              >
                <header className="flex items-center justify-between gap-2">
                  <span className="font-mono text-tower-accent-solar">{r.tool}</span>
                  {r.denied ? (
                    <StatusBadge tone="error">denied</StatusBadge>
                  ) : (
                    <StatusBadge tone="done">ok</StatusBadge>
                  )}
                </header>
                <p className="m-0 wrap-anywhere font-mono text-tower-text-primary">{r.path}</p>
                <dl className="m-0 grid grid-cols-[56px_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-tower-text-secondary">
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
                  {r.createdAt ? (
                    <>
                      <dt className="text-tower-text-muted">at</dt>
                      <dd className="m-0">{new Date(r.createdAt).toLocaleTimeString()}</dd>
                    </>
                  ) : null}
                </dl>
              </article>
            ))}
          </div>
        )}
      </FeedState>
    </HudPanel>
  );
}
