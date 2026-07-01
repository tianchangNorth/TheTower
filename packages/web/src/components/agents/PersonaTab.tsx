"use client";

import type { Agent, AgentPersona } from "@the-tower/shared";
import { Input } from "@/components/ui/input";
import { Field } from "./Field";
import { splitList } from "@/lib/format";
import type { TabProps } from "./OverviewTab";

export function PersonaTab({ agent, agentId, onPatch }: TabProps) {
  const p = agent.persona;
  const upd = (patch: Partial<AgentPersona>) => onPatch(agentId, { persona: { ...p, ...patch } });
  return (
    <div className="grid gap-3">
      <Field label="Role">
        <Input value={p.roleDescription} onChange={(e) => upd({ roleDescription: e.target.value })} />
      </Field>
      <Field label="Personality">
        <Input value={p.personality} onChange={(e) => upd({ personality: e.target.value })} />
      </Field>
      <Field label="Strengths" hint="逗号分隔">
        <Input value={p.strengths.join(", ")} onChange={(e) => upd({ strengths: splitList(e.target.value) })} />
      </Field>
      <Field label="Restrictions" hint="逗号分隔">
        <Input value={p.restrictions.join(", ")} onChange={(e) => upd({ restrictions: splitList(e.target.value) })} />
      </Field>
      <Field label="Background">
        <Input
          value={p.background ?? ""}
          onChange={(e) => upd({ background: e.target.value || undefined })}
        />
      </Field>
      <Field label="Voice instruct">
        <Input
          value={p.voice?.instruct ?? ""}
          onChange={(e) => upd({ voice: { ...p.voice, instruct: e.target.value || undefined } })}
        />
      </Field>
      <Field label="Signature">
        <Input
          value={p.signature ?? ""}
          onChange={(e) => upd({ signature: e.target.value || undefined })}
        />
      </Field>
    </div>
  );
}
