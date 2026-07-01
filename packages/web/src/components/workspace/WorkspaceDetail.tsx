"use client";

import type { Workspace } from "@the-tower/shared";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";

export function WorkspaceDetail({
  workspace,
  loading,
  error,
}: {
  workspace?: Workspace;
  loading: boolean;
  error?: string;
}) {
  if (loading && !workspace) {
    return (
      <HudPanel corner className="w-[320px] shrink-0">
        <p className="m-auto p-4 text-[12px] text-tower-text-muted">Loading…</p>
      </HudPanel>
    );
  }
  if (error || !workspace) {
    return (
      <HudPanel corner className="w-[320px] shrink-0">
        <p className="m-auto p-4 text-[12px] text-tower-accent-danger">
          {error ?? "workspace not found"}
        </p>
      </HudPanel>
    );
  }
  return (
    <HudPanel corner className="w-[320px] shrink-0">
      <PanelHeader title={workspace.name} />
      <div className="min-h-0 flex-1 overflow-auto p-2.5 grid content-start gap-2 text-[12px]">
        <dl className="m-0 grid grid-cols-[80px_minmax(0,1fr)] gap-x-2 gap-y-1 text-tower-text-secondary">
          <dt className="text-tower-text-muted">path</dt>
          <dd className="m-0 wrap-anywhere font-mono">{workspace.projectPath}</dd>
          <dt className="text-tower-text-muted">id</dt>
          <dd className="m-0 font-mono">{workspace.id}</dd>
          <dt className="text-tower-text-muted">trusted</dt>
          <dd className="m-0">{new Date(workspace.trustedAt).toLocaleString()}</dd>
          <dt className="text-tower-text-muted">last used</dt>
          <dd className="m-0">{new Date(workspace.lastOpenedAt).toLocaleString()}</dd>
          <dt className="text-tower-text-muted">fingerprint</dt>
          <dd className="m-0 text-tower-text-muted">—（后续 phase）</dd>
        </dl>
        <p className="text-[11px] text-tower-text-muted">
          validity（invalid/stale）实时校验与 fingerprint 将在后续 phase 落地。
        </p>
      </div>
    </HudPanel>
  );
}
