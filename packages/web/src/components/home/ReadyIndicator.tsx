"use client";

import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { cn } from "@/components/ui/cn";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { flavor } from "@/lib/homeFlavor";
import type { SseStatus } from "@/stores/sseStore";

interface ReadyIndicatorProps {
  running: number;
  sse: SseStatus;
}

/**
 * 底部就绪指示：2px 横线 + 文字。
 * idle=strand 2.4s 呼吸「系统就绪」；running>0=arc 1.6s「待命」；
 * SSE error=danger 常亮「链路中断」。色盲安全：永远带文字。
 * 入场 opacity 0→1 @1500ms。reduced-motion 下瞬显 + 关呼吸。
 */
export function ReadyIndicator({ running, sse }: ReadyIndicatorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  const errored = sse === "stale";
  const isRunning = running > 0;
  const breathe = !errored;
  const cycle = isRunning ? 1600 : 2400;

  const lineClass = errored
    ? "bg-tower-accent-danger"
    : isRunning
      ? "bg-tower-accent-arc"
      : "bg-tower-accent-strand";
  const textClass = errored
    ? "text-tower-accent-danger"
    : isRunning
      ? "text-tower-accent-arc"
      : "text-tower-accent-strand";
  const label = errored
    ? flavor("readyError")
    : isRunning
      ? flavor("readyRunning")
      : flavor("readyIdle");

  // 入场：一次性，1500ms 后淡入
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (reduced) {
      root.style.opacity = "1";
      return;
    }
    const a = animate(root, {
      opacity: [0, 1],
      duration: 500,
      ease: "outQuad",
      delay: 1500,
    });
    return () => {
      a.pause();
    };
  }, [reduced]);

  // 呼吸：横线 opacity 0.3↔1，按状态切节拍；error 常亮
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const lines = Array.from(root.querySelectorAll<HTMLElement>("[data-line]"));
    if (reduced || !breathe) {
      lines.forEach((el) => {
        el.style.opacity = "1";
      });
      return;
    }
    const anims = lines.map((el) =>
      animate(el, {
        opacity: [0.3, 1, 0.3],
        duration: cycle,
        loop: true,
        ease: "inOutSine",
      }),
    );
    return () => {
      anims.forEach((a) => {
        a.pause();
      });
    };
  }, [reduced, breathe, cycle]);

  return (
    <div ref={ref} className="flex items-center justify-center gap-2.5" style={{ opacity: 0 }}>
      <span data-line className={cn("h-px w-10 sm:w-16", lineClass)} style={{ opacity: 0 }} />
      <span className={cn("text-[11px] font-bold uppercase tracking-[0.2em]", textClass)}>
        {label}
      </span>
      <span data-line className={cn("h-px w-10 sm:w-16", lineClass)} style={{ opacity: 0 }} />
    </div>
  );
}
