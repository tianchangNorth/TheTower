"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, Plus, Search, Trash2 } from "lucide-react";
import type { Thread } from "@the-tower/shared";
import { useThreads } from "@/hooks/useThreads";
import { useCreateThread } from "@/hooks/useCreateThread";
import { useConfirm } from "@/hooks/useConfirm";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { SegmentedControl } from "@/components/hud/SegmentedControl";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/cn";
import { workspaceLabel } from "@/lib/format";

type ModeFilter = "all" | "play" | "debug";
type Sort = "updated" | "created";

export function ThreadsPageClient() {
  const { threads, deleteThread } = useThreads();
  const openCreateThread = useCreateThread();
  const confirm = useConfirm();

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [sort, setSort] = useState<Sort>("updated");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = threads.filter((t) => {
      if (mode !== "all" && (t.mode ?? "debug") !== mode) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        workspaceLabel(t.projectPath).toLowerCase().includes(q)
      );
    });
    const sorted = [...filtered].sort((a, b) => {
      const left = sort === "updated" ? a.updatedAt : a.createdAt;
      const right = sort === "updated" ? b.updatedAt : b.createdAt;
      return right - left;
    });
    return sorted;
  }, [threads, query, mode, sort]);

  const handleDelete = async (thread: Thread) => {
    const ok = await confirm({
      title: "Delete thread",
      description: "Delete this thread and all its messages? 此操作不可撤销。",
      confirmLabel: "Delete",
      cancelLabel: "取消",
      danger: true,
    });
    if (!ok) return;
    // 列表页原地删除：useThreads 内部已 refresh，行自动消失，不跳转。
    await deleteThread(thread.id);
  };

  return (
    <main className="h-full min-h-0 overflow-auto bg-tower-bg-base p-4">
      <div className="mx-auto grid max-w-350 gap-4">
        <HudPanel corner className="min-h-0">
          <PanelHeader
            title="Threads"
            icon={<MessageSquare size={15} />}
            action={
              <Button size="sm" variant="ghost" onClick={openCreateThread}>
                <Plus size={13} /> New
              </Button>
            }
          />

          {/* 工具条 */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-tower-border-subtle p-2.5">
            <div className="relative min-w-0 flex-1">
              <Search
                size={13}
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-tower-text-muted"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title or workspace…"
                className="pl-7"
              />
            </div>
            <SegmentedControl
              options={[
                { id: "all" as const, label: "All" },
                { id: "play" as const, label: "Play" },
                { id: "debug" as const, label: "Debug" },
              ]}
              value={mode}
              onChange={setMode}
            />
            <SegmentedControl
              options={[
                { id: "updated" as const, label: "Recent" },
                { id: "created" as const, label: "Created" },
              ]}
              value={sort}
              onChange={setSort}
            />
          </div>

          {/* 列表 */}
          <div className="min-h-0 flex-1 overflow-auto p-2.5">
            {visible.length === 0 ? (
              <div className="m-auto flex flex-col items-center gap-3 p-8 text-center">
                <p className="m-0 text-[13px] text-tower-text-muted">
                  {threads.length === 0
                    ? "No threads yet."
                    : "No threads match your filter."}
                </p>
                <Button variant="solid" size="md" onClick={openCreateThread}>
                  <Plus size={15} /> New thread
                </Button>
              </div>
            ) : (
              <ul className="m-0 grid gap-1.5">
                {visible.map((t) => (
                  <ThreadListRow key={t.id} thread={t} onDelete={() => handleDelete(t)} />
                ))}
              </ul>
            )}
          </div>
        </HudPanel>
      </div>
    </main>
  );
}

function ThreadListRow({
  thread,
  onDelete,
}: {
  thread: Thread;
  onDelete: () => void;
}) {
  return (
    <li>
      <Link
        href={`/threads/${thread.id}`}
        className="group grid gap-0.75 rounded-tower border border-tower-border-subtle bg-tower-bg-panel p-2.5 transition-colors hover:border-tower-border-energy hover:bg-tower-bg-hover"
      >
        <div className="flex items-center justify-between gap-2">
          <strong className="truncate text-[13px] text-tower-text-primary">{thread.title}</strong>
          <div className="inline-flex items-center gap-1.5">
            <StatusBadge tone={thread.mode === "play" ? "done" : "info"}>
              {thread.mode ?? "debug"}
            </StatusBadge>
            <button
              type="button"
              aria-label={`Delete thread ${thread.title}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDelete();
              }}
              className={cn(
                "text-tower-text-muted opacity-0 transition hover:text-tower-accent-danger group-hover:opacity-100",
              )}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-tower-text-muted">
          <span className="truncate font-mono">{workspaceLabel(thread.projectPath)}</span>
          <time>{new Date(thread.updatedAt).toLocaleString()}</time>
        </div>
      </Link>
    </li>
  );
}
