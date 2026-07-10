"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useAgents } from "@/hooks/useAgents";
import { useThreads } from "@/hooks/useThreads";
import { useThreadMessages } from "@/hooks/useThreadMessages";
import { useThreadRuntime } from "@/hooks/useThreadRuntime";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useEventStream } from "@/hooks/useEventStream";
import { useConfirm } from "@/hooks/useConfirm";
import { useThreadStore } from "@/stores/threadStore";
import { shouldRefreshThreadData, shouldRefreshThreadList } from "@/lib/eventFlow";
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
  const runtime = useThreadRuntime(threadId);
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
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refreshCurrentThread = useRef(false);
  const refreshThreadList = useRef(false);
  const confirm = useConfirm();
  // URL truth：路由 threadId 同步 store。
  useEffect(() => {
    setCurrentThreadId(threadId);
  }, [threadId, setCurrentThreadId]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  const scheduleEventRefresh = useCallback(
    (event: Parameters<typeof shouldRefreshThreadData>[0]) => {
      const refreshList = shouldRefreshThreadList(event);
      const refreshSelectedThread = shouldRefreshThreadData(event, threadId);
      if (!refreshList && !refreshSelectedThread) return;
      refreshThreadList.current ||= refreshList;
      refreshCurrentThread.current ||= refreshSelectedThread;
      if (refreshTimer.current) return;
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = undefined;
        const refreshSelectedThread = refreshCurrentThread.current;
        const refreshList = refreshThreadList.current;
        refreshCurrentThread.current = false;
        refreshThreadList.current = false;
        if (refreshList) void refreshThreads();
        if (refreshSelectedThread) void messages.refresh();
      }, 100);
    },
    [messages, refreshThreads, threadId],
  );

  const sseStatus = useEventStream({
    url: getSseUrl(),
    onEvent: (event) => {
      runtime.applyEvent(event);
      scheduleEventRefresh(event);
    },
    onDisconnect: () => {
      void runtime.refresh();
    },
  });

  const selectedThread = threads.find((thread) => thread.id === threadId);
  const activeInvocation = useMemo(
    () => messages.invocations.find((invocation) => invocation.status === "queued" || invocation.status === "running"),
    [messages.invocations],
  );

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
      // 删除前快照算相邻 thread：删当前 thread 时无缝切到邻居，保持 threads 上下文。
      const index = threads.findIndex((t) => t.id === id);
      const neighbor =
        index >= 0 ? threads[index - 1] ?? threads[index + 1] : undefined;
      await deleteThread(id);
      if (id === threadId) {
        router.push(neighbor ? `/threads/${neighbor.id}` : "/threads");
      }
    },
    [confirm, deleteThread, router, threadId, threads],
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

  const handleStop = useCallback(async () => {
    if (!activeInvocation) return;
    setSendError(undefined);
    try {
      await messages.cancelInvocation(activeInvocation.id);
    } catch (err) {
      setSendError((err as Error).message);
    }
  }, [activeInvocation, messages]);

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
        {sseStatus === "stale" ? (
          <div className="flex shrink-0 items-center gap-2 rounded-tower border border-tower-accent-solar/40 bg-tower-accent-solar/10 px-2.5 py-1.5 text-[12px] text-tower-accent-solar">
            <AlertTriangle size={13} />
            SSE disconnected — 实时事件暂停，重连后自动恢复。
          </div>
        ) : null}
        <MissionFeed
          threadId={threadId}
          thread={selectedThread}
          agents={agents}
          messages={messages.messages}
          filter={filter}
          onFilterChange={(value) => setFilter(threadId, value)}
          draft={draft}
          onDraftChange={(value) => setDraft(threadId, value)}
          onSend={handleSend}
          onStop={handleStop}
          busy={busy}
          running={Boolean(activeInvocation)}
          stopping={messages.cancellingInvocationId === activeInvocation?.id}
          sendError={sendError}
          onReveal={handleReveal}
          onReload={() => void messages.refresh()}
        />
      </div>
      <AgentRoster agents={agents} statuses={runtime.statuses} selectedThreadId={threadId} />
    </main>
  );
}
