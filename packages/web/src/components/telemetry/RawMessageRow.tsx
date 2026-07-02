"use client";

import type { Message } from "@the-tower/shared";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { shortId } from "@/lib/format";

/**
 * 原始消息行：展示 Message 的全部字段，不做投影/聚合/去重。
 * 给 Raw messages 与 Agent context 两个 inspect 视图共用。
 */
export function RawMessageRow({ message }: { message: Message }) {
  const time = new Date(message.createdAt).toISOString();
  return (
    <article className="grid gap-1 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated p-2 text-[12px]">
      <header className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-tower-text-muted">{shortId(message.id)}</span>
        <span className="font-bold text-tower-text-primary">
          {message.senderType}
          {message.senderId ? `:${message.senderId}` : ""}
        </span>
        {message.origin ? <StatusBadge tone="info">{message.origin}</StatusBadge> : null}
        {message.visibility ? (
          <StatusBadge tone={message.visibility === "private" ? "void" : "done"}>
            {message.visibility}
          </StatusBadge>
        ) : null}
        {message.deliveryStatus && message.deliveryStatus !== "delivered" ? (
          <StatusBadge tone="error">{message.deliveryStatus}</StatusBadge>
        ) : null}
        {message.revealedAt ? <StatusBadge tone="done">revealed</StatusBadge> : null}
        {message.handoffPayload ? <StatusBadge tone="thinking">handoff</StatusBadge> : null}
        <span className="ml-auto font-mono text-tower-text-muted">{time}</span>
      </header>
      <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-tower-text-secondary">
        {message.invocationId ? (
          <>
            <dt className="text-tower-text-muted">invocation</dt>
            <dd className="m-0 font-mono">{shortId(message.invocationId)}</dd>
          </>
        ) : null}
        {message.replyTo ? (
          <>
            <dt className="text-tower-text-muted">replyTo</dt>
            <dd className="m-0 font-mono">{shortId(message.replyTo)}</dd>
          </>
        ) : null}
        {message.visibleToAgentIds && message.visibleToAgentIds.length > 0 ? (
          <>
            <dt className="text-tower-text-muted">visibleTo</dt>
            <dd className="m-0 font-mono">{message.visibleToAgentIds.join(", ")}</dd>
          </>
        ) : null}
        {message.mentions.length > 0 ? (
          <>
            <dt className="text-tower-text-muted">mentions</dt>
            <dd className="m-0 font-mono">{message.mentions.join(", ")}</dd>
          </>
        ) : null}
      </dl>
      <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-tower)] bg-tower-bg-base p-1.5 font-mono text-[11px] text-tower-text-primary">
        {message.content || "(empty content)"}
      </pre>
      {message.handoffPayload ? (
        <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-base p-1.5 font-mono text-[11px] text-tower-text-secondary">
          {JSON.stringify(message.handoffPayload, null, 2)}
        </pre>
      ) : null}
    </article>
  );
}
