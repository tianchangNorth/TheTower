import { WorkspaceDetailPageClient } from "@/components/workspace/WorkspaceDetailPageClient";

// 工作区详情：path / trusted / thread 绑定 / 工具活动。
export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <WorkspaceDetailPageClient workspaceId={workspaceId} />;
}
