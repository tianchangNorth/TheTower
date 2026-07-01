"use client";

import type { ServerEvent } from "@the-tower/shared";
import { useTelemetryStore } from "@/stores/telemetryStore";
import { FeedState, Empty } from "./FeedState";
import { formatEventLabel } from "@/lib/eventFormat";

function eventTime(event: ServerEvent): string {
  if ("createdAt" in event && typeof event.createdAt === "number") {
    return new Date(event.createdAt).toLocaleTimeString();
  }
  return "";
}

/** 事件流：默认格式化一行，点击展开 JSON。 */
export function EventFeed() {
  const events = useTelemetryStore((s) => s.events);
  const status = useTelemetryStore((s) => s.status.events);
  const error = useTelemetryStore((s) => s.error.events);

  return (
    <FeedState loading={status === "loading"} error={error}>
      {events.length === 0 ? (
        <Empty text="No events match filters." />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-2 grid content-start gap-1.5">
          {events.map(({ seq, event }) => (
            <details
              key={seq}
              className="rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated text-[12px]"
            >
              <summary className="flex cursor-pointer items-center gap-2 px-2 py-1 text-tower-text-secondary">
                <span className="font-mono text-tower-text-muted">#{seq}</span>
                <span className="truncate">{formatEventLabel(event)}</span>
                <span className="ml-auto shrink-0 font-mono text-[11px] text-tower-text-muted">
                  {eventTime(event)}
                </span>
              </summary>
              <pre className="m-0 wrap-anywhere whitespace-pre-wrap border-t border-tower-border-subtle p-2 font-mono text-[11px] text-tower-text-primary">
                {JSON.stringify(event, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      )}
    </FeedState>
  );
}
