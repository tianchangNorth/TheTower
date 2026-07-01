import type { ServerEvent, TelemetryEventEntry } from "../types.js";

type Listener = (event: ServerEvent) => void;

/**
 * 进程内事件总线。
 * 保留有限 ring buffer 供 Telemetry 查询（GET /api/events、/api/tool-audit），
 * 重启后清空 → capability: live_only。持久化（落盘 + SSE catch-up）在后续 phase。
 */
export class EventBus {
  private readonly listeners = new Set<Listener>();
  private readonly buffer: TelemetryEventEntry[] = [];
  private seq = 0;
  private readonly bufferLimit = 500;

  publish(event: ServerEvent): void {
    const seq = ++this.seq;
    this.buffer.push({ seq, event });
    if (this.buffer.length > this.bufferLimit) this.buffer.shift();
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 返回 ring buffer 副本（最新在后）。 */
  recent(): TelemetryEventEntry[] {
    return [...this.buffer];
  }
}
