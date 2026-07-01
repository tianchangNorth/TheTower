"use client";

import { useMemo, useState } from "react";
import { useTaskStore } from "@/stores/taskStore";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { SegmentedControl } from "@/components/hud/SegmentedControl";
import { FeedState, Empty } from "@/components/telemetry/FeedState";
import { TaskCard } from "./TaskCard";
import { TASK_STATUSES } from "@/lib/tasks";
import type { TaskStatus } from "@the-tower/shared";

type StatusFilter = "all" | TaskStatus;

export function TaskBoard({ selectedTaskId }: { selectedTaskId?: string }) {
  const tasks = useTaskStore((s) => s.tasks);
  const status = useTaskStore((s) => s.status);
  const error = useTaskStore((s) => s.error);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [owner, setOwner] = useState("");
  const [ws, setWs] = useState("");

  const filtered = useMemo(() => {
    const o = owner.trim().toLowerCase();
    const w = ws.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (o && !(t.ownerAgentId ?? "").toLowerCase().includes(o)) return false;
      if (w && !(t.projectPath ?? "").toLowerCase().includes(w)) return false;
      return true;
    });
  }, [tasks, filter, owner, ws]);

  return (
    <HudPanel corner className="min-w-0 flex-1">
      <PanelHeader title="Tasks" />
      <div className="flex flex-wrap items-center gap-2 border-b border-tower-border-subtle px-2.5 py-1.5 text-[12px]">
        <SegmentedControl<StatusFilter>
          value={filter}
          onChange={setFilter}
          options={[{ id: "all" as const, label: "All" }, ...TASK_STATUSES.map((s) => ({ id: s, label: s }))]}
        />
        <label className="flex items-center gap-1 text-[11px] text-tower-text-muted">
          owner
          <input
            className="h-7.5 w-32 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated px-2 text-[12px] text-tower-text-primary outline-none focus-visible:border-tower-border-energy"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-tower-text-muted">
          workspace
          <input
            className="h-7.5 w-40 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated px-2 text-[12px] text-tower-text-primary outline-none focus-visible:border-tower-border-energy"
            value={ws}
            onChange={(e) => setWs(e.target.value)}
          />
        </label>
      </div>
      <FeedState loading={status === "loading"} error={error}>
        {filtered.length === 0 ? (
          <Empty text="No tasks match filters." />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-2 grid content-start gap-1.5">
            {filtered.map((t) => (
              <TaskCard key={t.id} task={t} selected={t.id === selectedTaskId} />
            ))}
          </div>
        )}
      </FeedState>
    </HudPanel>
  );
}
