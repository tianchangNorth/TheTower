"use client";

import { useMemo } from "react";
import { useAgents } from "@/hooks/useAgents";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useHealth } from "@/hooks/useHealth";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "./SettingsSection";

export function SettingsPageClient() {
  const { agents } = useAgents();
  const { workspaces } = useWorkspaces();
  const health = useHealth();
  const apiTarget = process.env.NEXT_PUBLIC_API_BASE_URL || "same-origin (proxied)";

  const providers = useMemo(() => {
    const map: Record<string, { total: number; enabled: number; models: Set<string> }> = {};
    for (const a of agents) {
      const entry = map[a.provider] ?? { total: 0, enabled: 0, models: new Set<string>() };
      entry.total += 1;
      if (a.enabled) entry.enabled += 1;
      entry.models.add(a.model);
      map[a.provider] = entry;
    }
    return Object.entries(map);
  }, [agents]);

  return (
    <main className="h-full min-h-0 overflow-auto bg-tower-bg-base p-3">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <SettingsSection
          title="Service health"
          action={<StatusBadge tone={health === "ok" ? "done" : health === "error" ? "error" : "stall"}>API {health}</StatusBadge>}
        >
          <p className="m-0 text-tower-text-secondary">
            API health 由 <code className="font-mono text-tower-text-primary">/health</code> 轮询。
          </p>
          <p className="m-0 text-tower-text-muted">SSE 状态见 Command 顶部状态条。</p>
        </SettingsSection>

        <SettingsSection title="API connection">
          <dl className="m-0 grid grid-cols-[80px_minmax(0,1fr)] gap-x-2 gap-y-1 text-tower-text-secondary">
            <dt className="text-tower-text-muted">target</dt>
            <dd className="m-0 wrap-anywhere font-mono">{apiTarget}</dd>
            <dt className="text-tower-text-muted">proxy</dt>
            <dd className="m-0">next.config.ts rewrites → 127.0.0.1:3001</dd>
          </dl>
        </SettingsSection>

        <SettingsSection title="Providers">
          {providers.length === 0 ? (
            <p className="m-0 text-tower-text-muted">No agents.</p>
          ) : (
            <ul className="m-0 grid gap-1">
              {providers.map(([provider, info]) => (
                <li key={provider} className="flex items-center justify-between gap-2">
                  <span className="text-tower-text-primary">{provider}</span>
                  <span className="text-tower-text-muted">
                    {info.enabled}/{info.total} on · {info.models.size} model(s)
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="m-0 text-[11px] text-tower-text-muted">不暴露 secret；凭证状态在后续 phase 接入。</p>
        </SettingsSection>

        <SettingsSection
          title="MCP servers"
          action={<StatusBadge tone="info">unavailable</StatusBadge>}
        >
          <p className="m-0 text-tower-text-muted">
            MCP server 状态、工具目录与启用/禁用将在后续 phase 接入。
          </p>
        </SettingsSection>

        <SettingsSection
          title="Runner & sandbox"
          action={<StatusBadge tone="info">pending</StatusBadge>}
        >
          <dl className="m-0 grid grid-cols-[80px_minmax(0,1fr)] gap-x-2 gap-y-1 text-tower-text-secondary">
            <dt className="text-tower-text-muted">sandbox</dt>
            <dd className="m-0">—</dd>
            <dt className="text-tower-text-muted">timeout</dt>
            <dd className="m-0">—</dd>
            <dt className="text-tower-text-muted">concurrency</dt>
            <dd className="m-0">—</dd>
          </dl>
          <p className="m-0 text-[11px] text-tower-text-muted">runner/sandbox 配置摘要将在后续 phase 接入。</p>
        </SettingsSection>

        <SettingsSection title="Storage / diagnostics">
          <dl className="m-0 grid grid-cols-[80px_minmax(0,1fr)] gap-x-2 gap-y-1 text-tower-text-secondary">
            <dt className="text-tower-text-muted">workspaces</dt>
            <dd className="m-0">{workspaces.length} trusted</dd>
            <dt className="text-tower-text-muted">storage</dt>
            <dd className="m-0">SQLite (.the-tower/)</dd>
          </dl>
          <Button variant="outline" size="sm" disabled>
            导出诊断（占位）
          </Button>
        </SettingsSection>
      </div>
    </main>
  );
}
