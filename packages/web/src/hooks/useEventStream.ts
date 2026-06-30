"use client";

import { useEffect, useRef, useState } from "react";
import type { ServerEvent } from "@/types";
import { createEventStream, type EventStreamStatus } from "@/lib/eventStream";

export type { EventStreamStatus } from "@/lib/eventStream";

export interface UseEventStreamOptions {
  /** SSE 端点 URL，null 时不订阅。 */
  url: string | null;
  /** 收到事件时调用。回调以 ref 形式持有，每次渲染更新，避免重连。 */
  onEvent: (event: ServerEvent) => void;
  /** 连接出错时调用（EventSource 会自动重连，onopen 后恢复 connected）。 */
  onDisconnect?: () => void;
}

/**
 * 封装 EventSource 订阅。onEvent/onDisconnect 走 ref，URL 变化才重连，
 * 避免回调身份变化导致 SSE 反复重挂载。连接逻辑见 lib/eventStream.ts。
 */
export function useEventStream({ url, onEvent, onDisconnect }: UseEventStreamOptions): EventStreamStatus {
  const [status, setStatus] = useState<EventStreamStatus>("connecting");
  const onEventRef = useRef(onEvent);
  const onDisconnectRef = useRef(onDisconnect);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);
  useEffect(() => {
    onDisconnectRef.current = onDisconnect;
  }, [onDisconnect]);

  useEffect(() => {
    if (!url) {
      setStatus("connecting");
      return;
    }
    const controller = createEventStream(url, {
      onStatusChange: setStatus,
      onEvent: (event) => onEventRef.current(event),
      onDisconnect: () => onDisconnectRef.current?.(),
    });
    return () => controller.close();
  }, [url]);

  return status;
}
