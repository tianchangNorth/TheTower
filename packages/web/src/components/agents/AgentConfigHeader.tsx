"use client";

import { Save, RefreshCw, Check, AlertTriangle } from "lucide-react";
import type { Agent } from "@the-tower/shared";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { agentAccentClasses } from "@/lib/agentIdentity";
import { cn } from "@/components/ui/cn";
import type { AgentConfigStatus } from "@/stores/agentConfigStore";

export interface AgentConfigHeaderProps {
  agent: Agent;
  dirty: boolean;
  status: AgentConfigStatus;
  error?: string;
  onSave: () => void;
  onReload: () => void;
}

export function AgentConfigHeader({
  agent,
  dirty,
  status,
  error,
  onSave,
  onReload,
}: AgentConfigHeaderProps) {
  const acc = agentAccentClasses(agent.id);
  return (
    <div className="shrink-0 border-b border-tower-border-subtle px-3 py-2">
      <div className="flex items-center gap-3">
        <h2 className={cn("text-[15px] font-bold", acc.text)}>{agent.displayName}</h2>
        <span className="font-mono text-[11px] text-tower-text-muted">{agent.id}</span>
        <div className="ml-auto flex items-center gap-2">
          {dirty ? <StatusBadge tone="thinking">dirty</StatusBadge> : null}
          {status === "saving" ? (
            <StatusBadge tone="info">
              <RefreshCw size={11} className="animate-spin" /> saving
            </StatusBadge>
          ) : null}
          {status === "saved" ? (
            <StatusBadge tone="done">
              <Check size={11} /> saved
            </StatusBadge>
          ) : null}
          {status === "error" ? (
            <StatusBadge tone="error">
              <AlertTriangle size={11} /> error
            </StatusBadge>
          ) : null}
          <Button size="icon" variant="ghost" onClick={onReload} title="Reload">
            <RefreshCw size={13} />
          </Button>
          <Button
            size="sm"
            variant="solid"
            onClick={onSave}
            disabled={!dirty || status === "saving"}
          >
            <Save size={13} />
            Save
          </Button>
        </div>
      </div>
      {error ? <p className="mt-1 text-[11px] text-tower-accent-danger">{error}</p> : null}
    </div>
  );
}
