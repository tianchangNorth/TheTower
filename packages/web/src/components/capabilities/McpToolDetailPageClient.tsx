"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { McpToolParam } from "@the-tower/shared";
import { useMcpToolDetail } from "@/hooks/useMcpToolDetail";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { FeedState, Empty } from "@/components/telemetry/FeedState";

/** 单个 MCP 工具详情：name/title/description + 参数表（含嵌套对象展开）。 */
export function McpToolDetailPageClient({ toolName }: { toolName: string }) {
  const { tool, loading, error } = useMcpToolDetail(toolName);

  return (
    <main className="flex h-full min-h-0 flex-col gap-3 bg-tower-bg-base p-3">
      <Link
        href="/capabilities"
        className="flex items-center gap-1 text-[12px] text-tower-text-muted hover:text-tower-text-primary"
      >
        <ArrowLeft size={14} /> Capabilities
      </Link>
      <HudPanel accent className="min-h-0 flex-1">
        <PanelHeader title={tool?.name ?? toolName} />
        <FeedState loading={loading} error={error}>
          {!tool ? (
            <Empty text="MCP tool not found." />
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-3 grid content-start gap-3 text-[12px]">
              <section className="grid gap-1">
                <div className="flex items-center gap-1.5">
                  <StatusBadge tone="info">{tool.title}</StatusBadge>
                </div>
                <p className="text-tower-text-secondary">{tool.description}</p>
              </section>
              <section>
                <h4 className="mb-1 font-bold uppercase text-tower-text-secondary">Parameters</h4>
                {tool.parameters.length === 0 ? (
                  <p className="text-tower-text-muted">No parameters.</p>
                ) : (
                  <div className="grid content-start gap-1.5">
                    {tool.parameters.map((param) => (
                      <ParamRow key={param.name} param={param} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </FeedState>
      </HudPanel>
    </main>
  );
}

function ParamRow({ param, depth = 0 }: { param: McpToolParam; depth?: number }) {
  return (
    <div
      className="grid gap-0.5 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated p-1.5"
      style={{ marginLeft: depth * 12 }}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-tower-text-primary">{param.name}</span>
        <StatusBadge tone="info">{param.type}</StatusBadge>
        {param.required ? <StatusBadge tone="done">required</StatusBadge> : <StatusBadge tone="void">optional</StatusBadge>}
      </div>
      {param.description ? <p className="text-tower-text-muted">{param.description}</p> : null}
      {param.nested && param.nested.length > 0 ? (
        <div className="grid content-start gap-1.5">
          {param.nested.map((child) => (
            <ParamRow key={child.name} param={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
