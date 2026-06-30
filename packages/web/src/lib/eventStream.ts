import type { ServerEvent } from "@/types";

export type EventStreamStatus = "connecting" | "connected" | "error";

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
 * 浏览器原生 EventSource 在 onerror 后会自动重连，重连成功再次触发 onopen → connected。
 * 无丢失 catch-up（lastEventId/seq）需后端事件持久化，属 Phase 4 范围。
 */
export function createEventStream(
  url: string,
  handlers: EventStreamHandlers,
  EventSourceImpl: typeof EventSource = globalThis.EventSource,
): EventStreamController {
  handlers.onStatusChange("connecting");
  const source = new EventSourceImpl(url);
  source.onopen = () => handlers.onStatusChange("connected");
  source.onerror = () => {
    handlers.onStatusChange("error");
    handlers.onDisconnect?.();
  };
  source.onmessage = (message: MessageEvent) => {
    try {
      handlers.onEvent(JSON.parse(message.data) as ServerEvent);
    } catch {
      // 忽略非 JSON 事件
    }
  };
  return {
    close: () => source.close(),
  };
}
