"use client";

import type { ThreadTelemetryContextResponse } from "@the-tower/shared";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { FeedState, Empty } from "./FeedState";
import { shortId } from "@/lib/format";

export function ThreadContextPanel({
  threadId,
  context,
  loading,
  error,
}: {
  threadId?: string;
  context?: ThreadTelemetryContextResponse;
  loading: boolean;
  error?: string;
}) {
  return (
    <HudPanel corner className="w-[340px] shrink-0 max-[1280px]:hidden">
      <PanelHeader title="Thread context" />
      <FeedState loading={loading} error={error}>
        {!threadId ? (
          <Empty text="Select a thread to view context." />
        ) : !context ? (
          <Empty text="No context." />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-2.5 grid content-start gap-2.5 text-[12px]">
            <section className="grid gap-1">
              <div className="flex items-center justify-between gap-2">
                <strong className="truncate text-tower-text-primary">{context.thread.title}</strong>
                <StatusBadge tone={context.thread.mode === "play" ? "done" : "info"}>
                  {context.thread.mode ?? "debug"}
                </StatusBadge>
              </div>
              <span className="text-tower-text-muted">
                {context.workspaceLabel ?? "No workspace"}
              </span>
              {context.staleReason ? (
                <StatusBadge tone="stall">stale: {context.staleReason}</StatusBadge>
              ) : null}
            </section>

            <section>
              <h4 className="mb-1 font-bold uppercase text-tower-text-secondary">Messages</h4>
              <div className="grid grid-cols-2 gap-1 text-tower-text-secondary">
                <span>total {context.messageCounts.total}</span>
                <span>public {context.messageCounts.public}</span>
                <span>private {context.messageCounts.private}</span>
                <span>revealed {context.messageCounts.revealed}</span>
                <span>handoff {context.messageCounts.handoff}</span>
              </div>
            </section>

            {context.latestInvocation ? (
              <section>
                <h4 className="mb-1 font-bold uppercase text-tower-text-secondary">
                  Latest invocation
                </h4>
                <dl className="m-0 grid grid-cols-[64px_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-tower-text-secondary">
                  <dt className="text-tower-text-muted">id</dt>
                  <dd className="m-0 font-mono">{shortId(context.latestInvocation.id)}</dd>
                  <dt className="text-tower-text-muted">status</dt>
                  <dd className="m-0">{context.latestInvocation.status}</dd>
                  <dt className="text-tower-text-muted">mode</dt>
                  <dd className="m-0">{context.latestInvocation.routeMode ?? "—"}</dd>
                  <dt className="text-tower-text-muted">targets</dt>
                  <dd className="m-0 wrap-anywhere">
                    {context.latestInvocation.targetAgents.join(", ") || "—"}
                  </dd>
                </dl>
              </section>
            ) : null}

            <section>
              <h4 className="mb-1 font-bold uppercase text-tower-text-secondary">Active agents</h4>
              <p className="m-0 text-tower-text-secondary">
                {context.activeAgentIds.length ? context.activeAgentIds.join(", ") : "—"}
              </p>
            </section>

            {context.privateVisibility.length > 0 ? (
              <section>
                <h4 className="mb-1 font-bold uppercase text-tower-text-secondary">
                  Private visibility
                </h4>
                <ul className="m-0 grid gap-0.5 text-tower-text-secondary">
                  {context.privateVisibility.map((v) => (
                    <li key={v.agentId} className="flex justify-between">
                      <span className="font-mono">{v.agentId}</span>
                      <span>{v.privateCount}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {context.recentMessages.length > 0 ? (
              <section>
                <h4 className="mb-1 font-bold uppercase text-tower-text-secondary">
                  Recent messages
                </h4>
                <ul className="m-0 grid gap-1 text-tower-text-secondary">
                  {context.recentMessages.map((m) => (
                    <li
                      key={m.id}
                      className="grid gap-0.5 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated p-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-tower-text-primary">
                          {m.senderId ?? m.senderType}
                        </span>
                        <div className="flex items-center gap-1">
                          {m.visibility === "private" ? (
                            <StatusBadge tone="void">private</StatusBadge>
                          ) : null}
                          {m.hasHandoff ? <StatusBadge tone="thinking">handoff</StatusBadge> : null}
                        </div>
                      </div>
                      <span className="text-tower-text-muted">{m.summary}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {context.note ? (
              <p className="text-[11px] text-tower-text-muted">{context.note}</p>
            ) : null}
          </div>
        )}
      </FeedState>
    </HudPanel>
  );
}
