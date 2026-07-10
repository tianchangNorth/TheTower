"use client";

import { SUPPORTED_AGENT_PROVIDERS, type Agent, type AgentProvider } from "@the-tower/shared";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "./Field";
import { Placeholder } from "./Placeholder";
import type { TabProps } from "./OverviewTab";

const providers: AgentProvider[] = ["mock", "codex", "claude", "gemini", "openai-api", "custom"];

export function ModelTab({ agent, agentId, onPatch }: TabProps) {
  return (
    <div className="grid gap-3">
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
      <Placeholder
        title="参数占位"
        note="temperature / maxTokens / reasoningEffort / fallback model 将在后续 phase 落地。"
      />
    </div>
  );
}
