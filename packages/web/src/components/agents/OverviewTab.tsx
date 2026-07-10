"use client";

import { SUPPORTED_AGENT_PROVIDERS, type Agent, type AgentProvider } from "@the-tower/shared";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "./Field";
import { agentAccentClasses } from "@/lib/agentIdentity";
import { cn } from "@/components/ui/cn";

const providers: AgentProvider[] = ["mock", "codex", "claude", "gemini", "openai-api", "custom"];

export interface TabProps {
  agent: Agent;
  agentId: string;
  onPatch: (agentId: string, patch: Partial<Agent>) => void;
}

export function OverviewTab({ agent, agentId, onPatch }: TabProps) {
  const acc = agentAccentClasses(agentId);
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 text-[12px]">
        <span className={cn("h-4 w-4 rounded border", acc.bg, acc.border)} />
        <span className="text-tower-text-muted">
          身份色：<span className={acc.text}>{acc.accent}</span>
        </span>
      </div>
      <Field label="Display name">
        <Input value={agent.displayName} onChange={(e) => onPatch(agentId, { displayName: e.target.value })} />
      </Field>
      <Field label="Mention handles" hint="逗号分隔">
        <Input
          value={agent.mentionHandles.join(", ")}
          onChange={(e) =>
            onPatch(agentId, {
              mentionHandles: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
            })
          }
        />
      </Field>
      <Field label="Provider">
        <Select
          value={agent.provider}
          onChange={(e) => onPatch(agentId, { provider: e.target.value as AgentProvider })}
        >
          {providers.map((p) => (
            <option key={p} value={p} disabled={!SUPPORTED_AGENT_PROVIDERS.includes(p)}>
              {SUPPORTED_AGENT_PROVIDERS.includes(p) ? p : `${p}（暂不支持）`}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Model">
        <Input value={agent.model} onChange={(e) => onPatch(agentId, { model: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-[12px] text-tower-text-secondary">
        <input
          type="checkbox"
          className="h-4 w-4 accent-tower-accent-arc"
          checked={agent.enabled}
          onChange={(e) => onPatch(agentId, { enabled: e.target.checked })}
        />
        Enabled
      </label>
      <Field label="Summary">
        <p className="m-0 text-[12px] text-tower-text-secondary">{agent.persona.roleDescription}</p>
      </Field>
    </div>
  );
}
