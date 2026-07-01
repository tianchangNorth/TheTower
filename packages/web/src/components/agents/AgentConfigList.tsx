"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Agent } from "@the-tower/shared";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { SegmentedControl } from "@/components/hud/SegmentedControl";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { useAgentConfigStore, isDraftDirty } from "@/stores/agentConfigStore";
import { agentAccentClasses } from "@/lib/agentIdentity";
import { cn } from "@/components/ui/cn";

type EnabledFilter = "all" | "enabled" | "disabled";

export interface AgentConfigListProps {
  agents: Agent[];
  selectedAgentId?: string;
}

export function AgentConfigList({ agents, selectedAgentId }: AgentConfigListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EnabledFilter>("all");
  const drafts = useAgentConfigStore((s) => s.drafts);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      if (filter === "enabled" && !a.enabled) return false;
      if (filter === "disabled" && a.enabled) return false;
      if (!q) return true;
      return (
        a.displayName.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.mentionHandles.join(" ").toLowerCase().includes(q)
      );
    });
  }, [agents, filter, query]);

  return (
    <HudPanel corner className="w-[300px] shrink-0">
      <PanelHeader title="Agents" />
      <div className="flex flex-col gap-2 border-b border-tower-border-subtle p-2.5">
        <div className="flex items-center gap-2 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated px-2">
          <Search size={14} className="text-tower-text-muted" />
          <input
            className="h-8 w-full border-0 bg-transparent text-[13px] text-tower-text-primary outline-none placeholder:text-tower-text-muted"
            placeholder="搜索 agent…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <SegmentedControl<EnabledFilter>
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "All" },
            { id: "enabled", label: "On" },
            { id: "disabled", label: "Off" },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2 grid content-start gap-1.5">
        {filtered.length === 0 ? (
          <p className="m-auto text-[12px] text-tower-text-muted">No agents.</p>
        ) : (
          filtered.map((a) => {
            const dirty = isDraftDirty(drafts[a.id]);
            const acc = agentAccentClasses(a.id);
            const selected = a.id === selectedAgentId;
            return (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                className={cn(
                  "block rounded-[var(--radius-tower)] border p-2 transition-colors hover:bg-tower-bg-hover",
                  selected ? "border-tower-border-energy bg-tower-accent-arc/10" : "border-transparent",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-[13px] font-bold", acc.text)}>{a.displayName}</span>
                  {dirty ? <StatusBadge tone="thinking">dirty</StatusBadge> : null}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-tower-text-muted">
                  <StatusBadge tone={a.enabled ? "done" : "info"}>{a.enabled ? "on" : "off"}</StatusBadge>
                  <span className="truncate">
                    {a.provider}/{a.model}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </HudPanel>
  );
}
