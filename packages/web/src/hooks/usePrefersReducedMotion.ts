"use client";

import { useEffect, useState } from "react";

/**
 * 统一的 prefers-reduced-motion 探测。
 * SSR 阶段返回 false，挂载后读取 matchMedia 并监听变化。
 * 替换 HomePage / DestinyEmblem 等各自手写的 guard。
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}
