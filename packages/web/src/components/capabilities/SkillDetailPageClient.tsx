"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSkillDetail } from "@/hooks/useSkillDetail";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { FeedState, Empty } from "@/components/telemetry/FeedState";

/** 单个 Skill 详情：manifest 全字段 + 完整 SKILL.md prompt。 */
export function SkillDetailPageClient({ skillId }: { skillId: string }) {
  const { skill, loading, error } = useSkillDetail(skillId);

  return (
    <main className="flex h-full min-h-0 flex-col gap-3 bg-tower-bg-base p-3">
      <Link
        href="/capabilities"
        className="flex items-center gap-1 text-[12px] text-tower-text-muted hover:text-tower-text-primary"
      >
        <ArrowLeft size={14} /> Capabilities
      </Link>
      <HudPanel accent className="min-h-0 flex-1">
        <PanelHeader title={skill?.manifest.name ?? skillId} />
        <FeedState loading={loading} error={error}>
          {!skill ? (
            <Empty text="Skill not found." />
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-3 grid content-start gap-3 text-[12px]">
              <section className="grid gap-1">
                <p className="text-tower-text-secondary">{skill.manifest.description}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {skill.manifest.category ? <StatusBadge tone="info">{skill.manifest.category}</StatusBadge> : null}
                  {skill.manifest.enabled ? <StatusBadge tone="done">enabled</StatusBadge> : <StatusBadge tone="void">disabled</StatusBadge>}
                  <StatusBadge tone="info">priority {skill.manifest.priority}</StatusBadge>
                  {skill.manifest.triggers.always ? <StatusBadge tone="done">always</StatusBadge> : null}
                  {skill.manifest.triggers.handoff ? <StatusBadge tone="thinking">handoff</StatusBadge> : null}
                  {skill.manifest.triggers.receiveHandoff ? <StatusBadge tone="thinking">receiveHandoff</StatusBadge> : null}
                  {skill.manifest.triggers.finalAgent ? <StatusBadge tone="info">finalAgent</StatusBadge> : null}
                </div>
              </section>

              {skill.manifest.triggers.keywords && skill.manifest.triggers.keywords.length > 0 ? (
                <section>
                  <h4 className="mb-1 font-bold uppercase text-tower-text-secondary">Keywords</h4>
                  <p className="font-mono text-tower-text-secondary">{skill.manifest.triggers.keywords.join(" · ")}</p>
                </section>
              ) : null}

              {skill.manifest.notFor && skill.manifest.notFor.length > 0 ? (
                <section>
                  <h4 className="mb-1 font-bold uppercase text-tower-text-secondary">Not for</h4>
                  <p className="text-tower-text-secondary">{skill.manifest.notFor.join("、")}</p>
                </section>
              ) : null}

              {skill.manifest.output ? (
                <section>
                  <h4 className="mb-1 font-bold uppercase text-tower-text-secondary">Output</h4>
                  <p className="text-tower-text-secondary">{skill.manifest.output}</p>
                </section>
              ) : null}

              {skill.manifest.next && skill.manifest.next.length > 0 ? (
                <section>
                  <h4 className="mb-1 font-bold uppercase text-tower-text-secondary">Next</h4>
                  <p className="font-mono text-tower-text-secondary">{skill.manifest.next.join(" → ")}</p>
                </section>
              ) : null}

              <section>
                <h4 className="mb-1 font-bold uppercase text-tower-text-secondary">Prompt (SKILL.md)</h4>
                <pre className="m-0 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-base p-2 font-mono text-[11px] text-tower-text-primary">
                  {skill.prompt}
                </pre>
              </section>
            </div>
          )}
        </FeedState>
      </HudPanel>
    </main>
  );
}
