"use client";

import { useTaskDetail } from "@/hooks/useTaskDetail";
import { TaskDetailPanel } from "./TaskDetailPanel";

export function TaskDetailPageClient({ taskId }: { taskId: string }) {
  const { createThread } = useTaskDetail(taskId);
  return (
    <main className="flex h-full min-h-0 gap-3 bg-tower-bg-base p-3">
      <TaskDetailPanel
        taskId={taskId}
        createThread={async (input) => {
          const { thread } = await createThread(input);
          return { threadId: thread.id };
        }}
      />
    </main>
  );
}
