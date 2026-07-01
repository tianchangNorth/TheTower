import { TaskDetailPageClient } from "@/components/tasks/TaskDetailPageClient";

// 任务详情：task -> thread -> invocation 映射，从 task 创建 thread。
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return <TaskDetailPageClient taskId={taskId} />;
}
