"use client";

import { useSearchParams } from "next/navigation";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { WorkspaceList } from "./WorkspaceList";

export function WorkspaceListPageClient() {
  const { workspaces, refresh } = useWorkspaces();
  const searchParams = useSearchParams();
  const highlight = searchParams.get("projectPath") ?? undefined;

  return (
    <main className="flex h-full min-h-0 flex-col bg-tower-bg-base">
      <WorkspaceHeader onRefresh={() => void refresh()} capability="live_only" />
      <div className="flex min-h-0 flex-1 p-3">
        <WorkspaceList workspaces={workspaces} highlightProjectPath={highlight} />
      </div>
    </main>
  );
}
