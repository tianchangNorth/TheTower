"use client";

import Link from "next/link";
import { useSkillsCatalog } from "@/hooks/useSkillsCatalog";
import { useMcpToolsCatalog } from "@/hooks/useMcpToolsCatalog";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { FeedState, Empty } from "@/components/telemetry/FeedState";

/** Capabilities 目录：Skills + MCP 工具两栏，每项可点跳详情。 */
export function CapabilitiesPageClient() {
  const { skills, loading: skillsLoading, error: skillsError } = useSkillsCatalog();
  const { tools, loading: toolsLoading, error: toolsError } = useMcpToolsCatalog();

  return (
    <main className="flex h-full min-h-0 gap-3 bg-tower-bg-base p-3">
      <HudPanel accent className="min-w-0 flex-1">
        <PanelHeader title="Skills" />
        <FeedState loading={skillsLoading} error={skillsError}>
          {skills.length === 0 ? (
            <Empty text="No skills loaded." />
          ) : (
            <ul className="m-0 grid min-h-0 flex-1 content-start gap-1.5 overflow-auto p-2.5">
              {skills.map((skill) => (
                <li key={skill.id}>
                  <Link
                    href={`/capabilities/skills/${skill.id}`}
                    className="grid gap-0.5 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated p-2 text-[12px] transition-colors hover:border-tower-border-energy"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate text-tower-text-primary">{skill.name}</strong>
                      <div className="flex items-center gap-1">
                        {skill.enabled ? null : <StatusBadge tone="void">disabled</StatusBadge>}
                        {skill.triggers.always ? <StatusBadge tone="done">always</StatusBadge> : null}
                        <span className="font-mono text-tower-text-muted">p{skill.priority}</span>
                      </div>
                    </div>
                    <span className="line-clamp-2 text-tower-text-secondary">{skill.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </FeedState>
      </HudPanel>
      <HudPanel accent className="min-w-0 flex-1">
        <PanelHeader title="MCP tools" />
        <FeedState loading={toolsLoading} error={toolsError}>
          {tools.length === 0 ? (
            <Empty text="No MCP tools registered." />
          ) : (
            <ul className="m-0 grid min-h-0 flex-1 content-start gap-1.5 overflow-auto p-2.5">
              {tools.map((tool) => (
                <li key={tool.name}>
                  <Link
                    href={`/capabilities/tools/${tool.name}`}
                    className="grid gap-0.5 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated p-2 text-[12px] transition-colors hover:border-tower-border-energy"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate font-mono text-tower-text-primary">{tool.name}</strong>
                      <StatusBadge tone="info">{tool.title}</StatusBadge>
                    </div>
                    <span className="line-clamp-2 text-tower-text-secondary">{tool.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </FeedState>
      </HudPanel>
    </main>
  );
}
