import { PagePlaceholder } from "@/components/shell/PagePlaceholder";
import { StatusBadge } from "@/components/hud/StatusBadge";

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <PagePlaceholder
      title={`Workspace · ${workspaceId}`}
      description="工作区详情。Phase 5 落地 fingerprint、文件活动与只读代码浏览。"
      badge={<StatusBadge tone="info">detail</StatusBadge>}
    />
  );
}
