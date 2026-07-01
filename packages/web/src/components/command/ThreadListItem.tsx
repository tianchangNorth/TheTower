"use client";

import { Trash2 } from "lucide-react";
import type { Thread } from "@the-tower/shared";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { cn } from "@/components/ui/cn";
import { workspaceLabel } from "@/lib/format";

export interface ThreadListItemProps {
  thread: Thread;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function ThreadListItem({ thread, selected, onSelect, onDelete }: ThreadListItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group grid gap-[3px] rounded-[var(--radius-tower)] border p-2 text-left transition-colors hover:bg-tower-bg-hover",
        selected ? "border-tower-border-energy bg-tower-accent-arc/10" : "border-transparent",
      )}
    >
      <span className="truncate text-[13px] text-tower-text-primary">{thread.title}</span>
      <div className="flex items-center justify-between gap-2">
        <time className="truncate font-mono text-[11px] text-tower-text-muted">
          {workspaceLabel(thread.projectPath)}
        </time>
        <div className="inline-flex items-center gap-1.5">
          <StatusBadge tone={thread.mode === "play" ? "done" : "info"}>{thread.mode ?? "debug"}</StatusBadge>
          <button
            type="button"
            aria-label={`Delete thread ${thread.title}`}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="text-tower-text-muted opacity-0 transition hover:text-tower-accent-danger group-hover:opacity-100"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
