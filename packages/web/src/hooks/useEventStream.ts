"use client";

import { useEffect, useRef } from "react";
import type { ServerEvent } from "@/types";
import { createEventStream, type EventStreamStatus } from "@/lib/eventStream";
import { useSseStore } from "@/stores/sseStore";

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
 * 封装 EventSource 订阅。onEvent/onDisconnect 走 ref，URL 变化才重连。
 * 连接状态写入全局 sseStore，供 TopCommandBar 显示真实 SSE 状态。
 */
export function useEventStream({ url, onEvent, onDisconnect }: UseEventStreamOptions): EventStreamStatus {
  const setStatus = useSseStore((s) => s.setStatus);
  const status = useSseStore((s) => s.status);
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
    setStatus("connecting");
    const controller = createEventStream(url, {
      onStatusChange: setStatus,
      onEvent: (event) => onEventRef.current(event),
      onDisconnect: () => onDisconnectRef.current?.(),
    });
    return () => controller.close();
  }, [url, setStatus]);

  return status;
}
