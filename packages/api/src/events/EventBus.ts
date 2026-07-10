import type { ServerEvent, TelemetryEventEntry } from "../types.js";
import type { EventLogStore } from "../stores/EventLogStore.js";

type Listener = (event: ServerEvent) => void;
type EnvelopeListener = (entry: TelemetryEventEntry) => void;

/**
 * 事件先追加到 SQLite，再广播给 SSE 与进程内订阅者。
 */
export class EventBus {
  private readonly listeners = new Set<Listener>();
  private readonly envelopeListeners = new Set<EnvelopeListener>();
  private readonly buffer: TelemetryEventEntry[] = [];
  private seq = 0;
  private readonly bufferLimit = 500;

  constructor(private readonly eventLog?: EventLogStore) {
    if (eventLog) {
      const history = eventLog.recent(this.bufferLimit);
      this.buffer.push(...history);
      this.seq = history.at(-1)?.seq ?? 0;
    }
  }

  publish(event: ServerEvent): void {
    const seq = this.eventLog?.append(event) ?? ++this.seq;
    this.seq = Math.max(this.seq, seq);
    const entry = { seq, event };
    this.buffer.push(entry);
    if (this.buffer.length > this.bufferLimit) this.buffer.shift();
    for (const listener of this.listeners) listener(event);
    for (const listener of this.envelopeListeners) listener(entry);
  }

  subscribeEntries(listener: EnvelopeListener): () => void {
    this.envelopeListeners.add(listener);
    return () => this.envelopeListeners.delete(listener);
  }

  replayAfter(seq: number, limit = 1_000): TelemetryEventEntry[] {
    if (this.eventLog) return this.eventLog.listAfter(seq, limit);
    return this.buffer.filter((entry) => entry.seq > seq).slice(0, limit);
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
