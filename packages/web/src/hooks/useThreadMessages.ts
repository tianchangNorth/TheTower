"use client";

import { useCallback, useEffect, useState } from "react";
import type { Invocation, Message, Thread, ThreadMode } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";

export function useThreadMessages(threadId: string | undefined) {
  const client = useTowerClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [invocations, setInvocations] = useState<Invocation[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!threadId) {
      setMessages([]);
      setInvocations([]);
      return;
    }
    setLoading(true);
    try {
      const [m, i] = await Promise.all([
        client.getThreadMessages(threadId, 200),
        client.getThreadInvocations(threadId, 50),
      ]);
      setMessages(m.messages);
      setInvocations(i.invocations);
    } finally {
      setLoading(false);
    }
  }, [client, threadId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 发送消息。threadId 缺省时创建新 thread，返回新 threadId 供路由跳转。 */
  const send = useCallback(
    async (content: string, projectPath?: string): Promise<string> => {
      const result = await client.postUserMessage({ threadId, content, projectPath });
      if (threadId) await refresh();
      return result.threadId;
    },
    [client, threadId, refresh],
  );

  const reveal = useCallback(
    async (messageId: string) => {
      if (!threadId) return;
      const result = await client.revealMessage(threadId, messageId);
      setMessages((items) => items.map((m) => (m.id === messageId ? result.message : m)));
    },
    [client, threadId],
  );

  const updateThread = useCallback(
    async (patch: { mode?: ThreadMode; projectPath?: string | null }): Promise<Thread> => {
      if (!threadId) throw new Error("no thread");
      const result = await client.updateThread(threadId, patch);
      return result.thread;
    },
    [client, threadId],
  );

  return { messages, invocations, loading, refresh, send, reveal, updateThread };
}
