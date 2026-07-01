"use client";

import Link from "next/link";
import type { Task } from "@the-tower/shared";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { cn } from "@/components/ui/cn";
import { taskPriorityTone, taskStatusTone } from "@/lib/tasks";

export function TaskCard({ task, selected }: { task: Task; selected?: boolean }) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      className={cn(
        "block rounded-[var(--radius-tower)] border p-2 transition-colors hover:bg-tower-bg-hover",
        selected ? "border-tower-border-energy bg-tower-accent-arc/10" : "border-tower-border-subtle",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <strong className="truncate text-[13px] font-bold text-tower-text-primary">{task.title}</strong>
        <div className="flex items-center gap-1">
          <StatusBadge tone={taskPriorityTone(task.priority)}>{task.priority}</StatusBadge>
          <StatusBadge tone={taskStatusTone(task.status)}>{task.status}</StatusBadge>
        </div>
      </div>
      {task.summary ? (
        <p className="m-0 mt-0.5 line-clamp-2 text-[12px] text-tower-text-secondary">{task.summary}</p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-tower-text-muted">
        {task.ownerAgentId ? <span>owner: {task.ownerAgentId}</span> : null}
        {task.threadIds.length > 0 ? (
          <StatusBadge tone="info">{task.threadIds.length} threads</StatusBadge>
        ) : null}
        {task.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-tower-bg-hover px-1.5 py-px">
            #{tag}
          </span>
        ))}
      </div>
    </Link>
  );
}
