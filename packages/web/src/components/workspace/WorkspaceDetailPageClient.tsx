"use client";

import { useWorkspace } from "@/hooks/useWorkspace";
import { useWorkspaceActivity } from "@/hooks/useWorkspaceActivity";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { WorkspaceDetail } from "./WorkspaceDetail";
import { ThreadBindings } from "./ThreadBindings";
import { WorkspaceActivityPanel } from "./WorkspaceActivityPanel";

export function WorkspaceDetailPageClient({ workspaceId }: { workspaceId: string }) {
  const { workspace, loading, error, refresh } = useWorkspace(workspaceId);
  const { refresh: refreshActivity } = useWorkspaceActivity(workspaceId);

  return (
    <main className="flex h-full min-h-0 flex-col bg-tower-bg-base">
      <WorkspaceHeader
        onRefresh={() => {
          void refresh();
          void refreshActivity();
        }}
        capability="live_only"
      />
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <WorkspaceDetail workspace={workspace} loading={loading} error={error} />
        <ThreadBindings />
        <WorkspaceActivityPanel />
      </div>
    </main>
  );
}
