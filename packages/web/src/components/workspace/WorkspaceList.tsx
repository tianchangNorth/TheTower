"use client";

import Link from "next/link";
import type { Workspace } from "@the-tower/shared";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { cn } from "@/components/ui/cn";

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString();
}

export function WorkspaceList({
  workspaces,
  highlightProjectPath,
}: {
  workspaces: Workspace[];
  highlightProjectPath?: string;
}) {
  return (
    <HudPanel corner className="min-w-0 flex-1">
      <PanelHeader title="Workspaces" />
      <div className="min-h-0 flex-1 overflow-auto p-2 grid content-start gap-1.5">
        {workspaces.length === 0 ? (
          <p className="m-auto p-4 text-[12px] text-tower-text-muted">No trusted workspaces.</p>
        ) : (
          workspaces.map((w) => {
            const highlight = Boolean(highlightProjectPath && w.projectPath === highlightProjectPath);
            return (
              <Link
                key={w.id}
                href={`/workspaces/${w.id}`}
                className={cn(
                  "block rounded-[var(--radius-tower)] border p-2 transition-colors hover:bg-tower-bg-hover",
                  highlight ? "border-tower-border-energy bg-tower-accent-arc/10" : "border-tower-border-subtle",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="truncate text-[13px] font-bold text-tower-text-primary">
                    {w.name}
                  </strong>
                  <StatusBadge tone="done">trusted</StatusBadge>
                </div>
                <p className="m-0 mt-0.5 wrap-anywhere truncate font-mono text-[11px] text-tower-text-muted">
                  {w.projectPath}
                </p>
                <p className="m-0 mt-0.5 text-[11px] text-tower-text-muted">
                  last used {formatTime(w.lastOpenedAt)}
                </p>
              </Link>
            );
          })
        )}
      </div>
    </HudPanel>
  );
}
