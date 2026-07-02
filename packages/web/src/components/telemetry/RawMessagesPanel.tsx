"use client";

import { useThreadMessages } from "@/hooks/useThreadMessages";
import { FeedState, Empty } from "./FeedState";
import { RawMessageRow } from "./RawMessageRow";

/**
 * 原始消息列表面板：直接渲染 useThreadMessages 返回的 Message[]，
 * 不过 projectMessagesToBubbles —— stream chunk 不聚合、callback 不去重。
 */
export function RawMessagesPanel({ threadId }: { threadId?: string }) {
  const { messages, loading } = useThreadMessages(threadId);
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);

  return (
    <FeedState loading={loading}>
      {!threadId ? (
        <Empty text="Select a thread to view raw messages." />
      ) : sorted.length === 0 ? (
        <Empty text="No messages." />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-2 grid content-start gap-1.5">
          {sorted.map((m) => (
            <RawMessageRow key={m.id} message={m} />
          ))}
        </div>
      )}
    </FeedState>
  );
}
