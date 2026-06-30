import type { EventLogItem, ServerEvent } from "@/types";

/**
 * Phase 1a：从 App.tsx 抽出的纯事件处理逻辑，便于单元测试线程作用域与日志截断。
 * 无丢失 catch-up（lastEventId/seq）需要后端事件持久化与 `id:` 行，属 Phase 4 范围。
 */

export const EVENT_LOG_CAP = 40;

export function isAgentRuntimeEvent(
  event: ServerEvent,
): event is Extract<
  ServerEvent,
  { type: "agent.status" | "agent.token_usage" | "agent.liveness" }
> {
  return event.type === "agent.status" || event.type === "agent.token_usage" || event.type === "agent.liveness";
}

/**
 * 决定是否要为当前选中 thread 刷新 messages/invocations。
 * 只在事件属于当前 thread 时刷新，避免跨 thread 串数据。
 */
export function shouldRefreshThreadData(event: ServerEvent, selectedThreadId: string | undefined): boolean {
  if (!selectedThreadId) return false;
  return event.threadId === selectedThreadId;
}

/** 追加事件到日志前端并截断到 EVENT_LOG_CAP，保持与旧 Vite 行为一致。 */
export function appendEventLog(
  items: EventLogItem[],
  event: ServerEvent,
  id: number,
  receivedAt: number,
): EventLogItem[] {
  return [{ id, receivedAt, event }, ...items].slice(0, EVENT_LOG_CAP);
}
