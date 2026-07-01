"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CreateTaskThreadRequest } from "@the-tower/shared";
import { useTaskStore } from "@/stores/taskStore";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedState, Empty } from "@/components/telemetry/FeedState";
import { taskPriorityTone, taskStatusTone } from "@/lib/tasks";
import { shortId } from "@/lib/format";

export function TaskDetailPanel({
  taskId,
  createThread,
}: {
  taskId: string;
  createThread: (input: CreateTaskThreadRequest) => Promise<{ threadId: string }>;
}) {
  const router = useRouter();
  const task = useTaskStore((s) => s.selected);
  const threads = useTaskStore((s) => s.selectedThreads);
  const status = useTaskStore((s) => s.selectedStatus);
  const error = useTaskStore((s) => s.selectedError);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>();

  async function handleCreate() {
    setBusy(true);
    setErr(undefined);
    try {
      const { threadId } = await createThread({ content: content.trim() || undefined });
      router.push(`/threads/${threadId}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <HudPanel accent className="min-w-0 flex-1">
      <PanelHeader title={task ? task.title : "Task"} />
      <FeedState loading={status === "loading"} error={error}>
        {!task ? (
          <Empty text="Task not found." />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-2.5 grid content-start gap-3 text-[12px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge tone={taskPriorityTone(task.priority)}>{task.priority}</StatusBadge>
              <StatusBadge tone={taskStatusTone(task.status)}>{task.status}</StatusBadge>
              {task.ownerAgentId ? <StatusBadge tone="info">owner: {task.ownerAgentId}</StatusBadge> : null}
              {task.tags.map((t) => (
                <span key={t} className="rounded-full bg-tower-bg-hover px-1.5 py-px text-tower-text-muted">
                  #{t}
                </span>
              ))}
            </div>
            {task.summary ? <p className="m-0 text-tower-text-secondary">{task.summary}</p> : null}
            <dl className="m-0 grid grid-cols-[80px_minmax(0,1fr)] gap-x-2 gap-y-1 text-tower-text-secondary">
              <dt className="text-tower-text-muted">id</dt>
              <dd className="m-0 font-mono">{task.id}</dd>
              <dt className="text-tower-text-muted">workspace</dt>
              <dd className="m-0 wrap-anywhere font-mono">{task.projectPath ?? "—"}</dd>
              <dt className="text-tower-text-muted">created</dt>
              <dd className="m-0">{new Date(task.createdAt).toLocaleString()}</dd>
            </dl>

            <section>
              <h4 className="mb-1 font-bold uppercase text-tower-text-secondary">Linked threads</h4>
              {threads.length === 0 ? (
                <p className="m-0 text-tower-text-muted">No threads yet.</p>
              ) : (
                <ul className="m-0 grid gap-1">
                  {threads.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/telemetry/${t.id}`}
                        className="flex items-center justify-between gap-2 rounded-[var(--radius-tower)] border border-tower-border-subtle px-2 py-1 hover:bg-tower-bg-hover"
                      >
                        <span className="truncate text-tower-text-primary">{t.title}</span>
                        <span className="font-mono text-[11px] text-tower-text-muted">{shortId(t.id)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid gap-2 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated p-2">
              <h4 className="m-0 font-bold uppercase text-tower-text-secondary">Create thread from task</h4>
              <Input
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="初始消息（留空则创建空 thread）"
              />
              {err ? <p className="text-[11px] text-tower-accent-danger">{err}</p> : null}
              <Button variant="solid" onClick={() => void handleCreate()} disabled={busy}>
                {busy ? "Creating…" : "Create thread"}
              </Button>
              <p className="m-0 text-[11px] text-tower-text-muted">
                创建后跳回 Command 工作台。填写初始消息会触发 Agent 运行。
              </p>
            </section>
          </div>
        )}
      </FeedState>
    </HudPanel>
  );
}
