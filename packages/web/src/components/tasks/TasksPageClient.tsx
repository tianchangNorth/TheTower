"use client";

import { useAgents } from "@/hooks/useAgents";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useTaskBoard } from "@/hooks/useTaskBoard";
import { TaskComposer } from "./TaskComposer";
import { TaskBoard } from "./TaskBoard";

export function TasksPageClient() {
  const { agents } = useAgents();
  const { workspaces } = useWorkspaces();
  const { createTask } = useTaskBoard();

  return (
    <main className="flex h-full min-h-0 gap-3 bg-tower-bg-base p-3">
      <TaskComposer
        agents={agents}
        workspaces={workspaces}
        onCreate={async (input) => {
          await createTask(input);
        }}
      />
      <TaskBoard />
    </main>
  );
}
