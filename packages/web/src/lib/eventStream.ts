import type { ServerEvent } from "@/types";

export type EventStreamStatus = "connecting" | "reconnecting" | "catching-up" | "synced" | "stale";

export interface EventStreamHandlers {
  onStatusChange: (status: EventStreamStatus) => void;
  onEvent: (event: ServerEvent) => void;
  onDisconnect?: () => void;
}

export interface EventStreamController {
  close: () => void;
}

/**
 * 封装 EventSource 订阅，脱离 React 以便单元测试连接/重连/事件转发。
 * 服务端以 SSE id + Last-Event-ID 重放遗漏事件；sync 事件代表本次追赶完成。
 */
export function createEventStream(
  url: string,
  handlers: EventStreamHandlers,
  EventSourceImpl: typeof EventSource = globalThis.EventSource,
): EventStreamController {
  handlers.onStatusChange("connecting");
  const source = new EventSourceImpl(url);
  let syncTimeout: ReturnType<typeof setTimeout> | undefined;
  const armStaleTimeout = () => {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => handlers.onStatusChange("stale"), 5_000);
  };
  source.onopen = () => {
    handlers.onStatusChange("catching-up");
    armStaleTimeout();
  };
  source.onerror = () => {
    if (syncTimeout) clearTimeout(syncTimeout);
    handlers.onStatusChange("reconnecting");
    handlers.onDisconnect?.();
  };
  source.addEventListener("sync", () => {
    if (syncTimeout) clearTimeout(syncTimeout);
    handlers.onStatusChange("synced");
  });
  source.onmessage = (message: MessageEvent) => {
    try {
      handlers.onEvent(JSON.parse(message.data) as ServerEvent);
    } catch {
      // 忽略非 JSON 事件
    }
  };
  return {
    close: () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      source.close();
    },
  };
}
