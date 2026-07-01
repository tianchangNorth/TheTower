"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import type { ThreadMode } from "@the-tower/shared";
import { useAgents } from "@/hooks/useAgents";
import { useThreads } from "@/hooks/useThreads";
import { useThreadMessages } from "@/hooks/useThreadMessages";
import { useThreadRuntime } from "@/hooks/useThreadRuntime";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useEventStream } from "@/hooks/useEventStream";
import { useConfirm } from "@/hooks/useConfirm";
import { useThreadStore } from "@/stores/threadStore";
import { shouldRefreshThreadData } from "@/lib/eventFlow";
import { getSseUrl } from "@/lib/sseUrl";
import { AgentRoster } from "./AgentRoster";
import { ThreadNavigator } from "./ThreadNavigator";
import { MissionFeed } from "./MissionFeed";

export interface CommandShellProps {
  threadId?: string;
}

export function CommandShell({ threadId }: CommandShellProps) {
  const router = useRouter();
  const { agents } = useAgents();
  const { threads, refresh: refreshThreads, deleteThread } = useThreads();
  const runtime = useThreadRuntime();
  const messages = useThreadMessages(threadId);

  const setCurrentThreadId = useThreadStore((s) => s.setCurrentThreadId);
  const setDraft = useThreadStore((s) => s.setDraft);
  const setFilter = useThreadStore((s) => s.setFilter);
  // 直接订阅 draft/filter 值，否则 setDraft 不会触发重渲染。
  const draftKey = threadId ?? "__new__";
  const draft = useThreadStore((s) => s.draftByThreadId[draftKey] ?? "");
  const filter = useThreadStore((s) => s.filterByThreadId[draftKey] ?? "all");

  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>();
  const confirm = useConfirm();
  // URL truth：路由 threadId 同步 store。
  useEffect(() => {
    setCurrentThreadId(threadId);
  }, [threadId, setCurrentThreadId]);

  const sseStatus = useEventStream({
    url: getSseUrl(),
    onEvent: (event) => {
      runtime.applyEvent(event);
      void refreshThreads();
      if (shouldRefreshThreadData(event, threadId)) void messages.refresh();
    },
    onDisconnect: () => {
      void runtime.refresh();
    },
  });

  const selectedThread = threads.find((thread) => thread.id === threadId);

  const handleSelectThread = useCallback(
    (id: string) => {
      router.push(`/threads/${id}`);
    },
    [router],
  );

  const handleDeleteThread = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: "Delete thread",
        description: "Delete this thread and all its messages? 此操作不可撤销。",
        confirmLabel: "Delete",
        cancelLabel: "取消",
        danger: true,
      });
      if (!ok) return;
      await deleteThread(id);
      if (id === threadId) router.push("/");
    },
    [confirm, deleteThread, router, threadId],
  );

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || !threadId) return;
    setBusy(true);
    setSendError(undefined);
    try {
      await messages.send(content);
      setDraft(threadId, "");
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [draft, threadId, messages, setDraft]);

  const handleModeChange = useCallback(
    async (mode: ThreadMode) => {
      try {
        await messages.updateThread({ mode });
        void refreshThreads();
      } catch {
        // 错误由 TopCommandBar health 与 sendError 模式覆盖
      }
    },
    [messages, refreshThreads],
  );

  const handleReveal = useCallback(
    async (messageId: string) => {
      await messages.reveal(messageId);
      void refreshThreads();
    },
    [messages, refreshThreads],
  );

  return (
    <main className="flex h-full min-h-0 gap-3 bg-tower-bg-base p-3">
      <ThreadNavigator
        threads={threads}
        selectedThreadId={threadId}
        onSelect={handleSelectThread}
        onDelete={handleDeleteThread}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {sseStatus === "error" ? (
          <div className="flex shrink-0 items-center gap-2 rounded-tower border border-tower-accent-solar/40 bg-tower-accent-solar/10 px-2.5 py-1.5 text-[12px] text-tower-accent-solar">
            <AlertTriangle size={13} />
            SSE disconnected — 实时事件暂停，重连后自动恢复。
          </div>
        ) : null}
        <MissionFeed
          threadId={threadId}
          thread={selectedThread}
          agents={agents}
          statuses={runtime.statuses}
          messages={messages.messages}
          filter={filter}
          onFilterChange={(value) => setFilter(threadId, value)}
          draft={draft}
          onDraftChange={(value) => setDraft(threadId, value)}
          onSend={handleSend}
          busy={busy}
          sendError={sendError}
          onModeChange={handleModeChange}
          onReveal={handleReveal}
          onReload={() => void messages.refresh()}
        />
      </div>
      <AgentRoster agents={agents} statuses={runtime.statuses} selectedThreadId={threadId} />
    </main>
  );
}
