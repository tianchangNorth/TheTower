"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useInvocationInspect } from "@/hooks/useInvocationInspect";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { FeedState, Empty } from "./FeedState";
import { shortId } from "@/lib/format";

/** 单个 invocation 详情：各 agent 这轮加载的 skills + 用到的 MCP 工具，每项可点跳详情。 */
export function InvocationDetailPageClient({ invocationId }: { invocationId: string }) {
  const { inspect, loading, error, refresh } = useInvocationInspect(invocationId);

  return (
    <main className="flex h-full min-h-0 flex-col gap-3 bg-tower-bg-base p-3">
      <div className="flex items-center justify-between">
        <Link
          href="/telemetry"
          className="flex items-center gap-1 text-[12px] text-tower-text-muted hover:text-tower-text-primary"
        >
          <ArrowLeft size={14} /> Telemetry
        </Link>
        <button
          onClick={() => void refresh()}
          className="flex items-center gap-1 text-[12px] text-tower-text-muted hover:text-tower-text-primary"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      <HudPanel accent className="min-h-0 flex-1">
        <PanelHeader title={`Invocation ${shortId(invocationId)}`} />
        <FeedState loading={loading} error={error}>
          {!inspect ? (
            <Empty text="Invocation not found." />
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-3 grid content-start gap-3 text-[12px]">
              <section className="grid gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge
                    tone={
                      inspect.invocation.status === "done"
                        ? "done"
                        : inspect.invocation.status === "running"
                          ? "thinking"
                          : inspect.invocation.status === "failed"
                            ? "error"
                            : "info"
                    }
                  >
                    {inspect.invocation.status}
                  </StatusBadge>
                  <StatusBadge tone="info">
                    {inspect.invocation.routeMode ?? (inspect.invocation.targetAgents.length > 1 ? "fanout" : "single")}
                  </StatusBadge>
                </div>
                <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-tower-text-secondary">
                  <dt className="text-tower-text-muted">targets</dt>
                  <dd className="m-0">{inspect.invocation.targetAgents.join(", ") || "(none)"}</dd>
                  <dt className="text-tower-text-muted">started</dt>
                  <dd className="m-0">{new Date(inspect.invocation.createdAt).toLocaleString()}</dd>
                </dl>
              </section>

              {inspect.agents.length === 0 ? (
                <Empty text="无 skills / 工具调用记录。进程重启后 ring buffer 会清空（live_only）。" />
              ) : (
                inspect.agents.map((agent) => (
                  <section
                    key={agent.agentId}
                    className="grid gap-2 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated p-2"
                  >
                    <h4 className="font-bold text-tower-text-primary">{agent.agentId}</h4>

                    <div>
                      <p className="mb-1 uppercase text-tower-text-secondary">Loaded skills</p>
                      {agent.loadedSkillIds.length === 0 ? (
                        <p className="text-tower-text-muted">(none)</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {agent.loadedSkillIds.map((id) => (
                            <Link key={id} href={`/capabilities/skills/${id}`}>
                              <StatusBadge tone="info">{id}</StatusBadge>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="mb-1 uppercase text-tower-text-secondary">MCP tools used</p>
                      {agent.toolCalls.length === 0 ? (
                        <p className="text-tower-text-muted">(none)</p>
                      ) : (
                        <ul className="m-0 grid content-start gap-1">
                          {agent.toolCalls.map((call) => (
                            <li key={call.name} className="flex items-center gap-1.5">
                              <Link href={`/capabilities/tools/${call.name}`}>
                                <StatusBadge tone="thinking">{call.name}</StatusBadge>
                              </Link>
                              <span className="text-tower-text-muted">×{call.count}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                ))
              )}

              {inspect.note ? <p className="text-[11px] text-tower-text-muted">{inspect.note}</p> : null}
            </div>
          )}
        </FeedState>
      </HudPanel>
    </main>
  );
}
