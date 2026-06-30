import { PagePlaceholder } from "@/components/shell/PagePlaceholder";
import { StatusBadge } from "@/components/hud/StatusBadge";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return (
    <PagePlaceholder
      title={`Task · ${taskId}`}
      description="任务详情。Phase 6 落地任务到 thread / invocation 的映射视图。"
      badge={<StatusBadge tone="info">detail</StatusBadge>}
    />
  );
}
