import { Suspense } from "react";
import { WorkspaceListPageClient } from "@/components/workspace/WorkspaceListPageClient";

// 工作区列表。useSearchParams 需 Suspense 包裹。
export default function WorkspacesPage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceListPageClient />
    </Suspense>
  );
}
