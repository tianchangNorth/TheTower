"use client";

import { useEffect, useState } from "react";
import { useAgents } from "@/hooks/useAgents";
import { useThreadContext } from "@/hooks/useThreadContext";
import { useThreadAgentContext } from "@/hooks/useThreadAgentContext";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { FeedState, Empty } from "./FeedState";
import { RawMessageRow } from "./RawMessageRow";

/**
 * 单个 agent 看到的上下文：调用 buildForAgent 等价的后端接口，
 * 返回经 VisibilityPolicy 过滤后的 Message[]。下拉选 agent，默认取线程首个 active agent。
 */
export function AgentContextPanel({ threadId }: { threadId?: string }) {
  const { agents } = useAgents();
  const { context: threadContext } = useThreadContext(threadId);
  const [agentId, setAgentId] = useState<string>("");

  // 默认选中线程首个 active agent；agent 列表到位后若未选则也兜底选第一个。
  useEffect(() => {
    if (agentId) return;
    const fallback =
      threadContext?.activeAgentIds?.[0] ?? agents.find((a) => a.enabled)?.id ?? "";
    if (fallback) setAgentId(fallback);
  }, [agentId, threadContext, agents]);

  const { context, loading, error } = useThreadAgentContext(threadId, agentId || undefined);
  const sorted = context ? [...context.messages].sort((a, b) => a.createdAt - b.createdAt) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div className="flex items-center gap-2">
        <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} disabled={!threadId}>
          <option value="" disabled>
            Select an agent
          </option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName} ({a.id})
            </option>
          ))}
        </Select>
        {context ? (
          <span className="flex items-center gap-1.5 text-[12px] text-tower-text-secondary">
            <StatusBadge tone={context.mode === "play" ? "done" : "info"}>
              {context.mode}
            </StatusBadge>
            <span>{sorted.length} messages</span>
          </span>
        ) : null}
      </div>
      <FeedState loading={loading} error={error}>
        {!threadId ? (
          <Empty text="Select a thread to view agent context." />
        ) : !agentId ? (
          <Empty text="Select an agent." />
        ) : sorted.length === 0 ? (
          <Empty text="No visible messages for this agent." />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto grid content-start gap-1.5">
            {sorted.map((m) => (
              <RawMessageRow key={m.id} message={m} />
            ))}
          </div>
        )}
      </FeedState>
    </div>
  );
}
