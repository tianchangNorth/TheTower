"use client";

import { useEffect, useRef, useState } from "react";
import { animate, type Target } from "animejs";
import { cn } from "@/components/ui/cn";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface Mote {
  left: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  drift: number;
  solar: boolean;
}

/**
 * 光尘粒子：20-30 个 1-2px 漂浮尘，主 text-primary 少量 solar。
 * 向上漂 12-24s 随机 loop + translateX ±6px 微抖，opacity 入淡出淡。
 * duration / delay 必须随机化，loop 错峰，避免同频机械感。
 * reduced-motion 下不渲染。容器 overflow-hidden + pointer-events-none。
 */
export function LightDust({ count = 26 }: { count?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [motes, setMotes] = useState<Mote[]>([]);

  // 客户端挂载后生成随机参数，避免 SSR 水合不一致
  useEffect(() => {
    setMotes(
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        size: 1 + Math.random() * 1.5,
        opacity: 0.2 + Math.random() * 0.4,
        duration: 12000 + Math.random() * 12000,
        delay: -Math.random() * 20000,
        drift: (Math.random() - 0.5) * 12,
        solar: Math.random() < 0.25,
      })),
    );
  }, [count]);

  useEffect(() => {
    if (reduced) return;
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-mote]"));
    if (!els.length) return;

    const a = animate(els, {
      translateY: [60, -420],
      translateX: (el?: Target) => [0, Number((el as HTMLElement | undefined)?.dataset?.drift) ?? 0, 0],
      opacity: (el?: Target) => [0, Number((el as HTMLElement | undefined)?.dataset?.opacity) ?? 0.4, 0],
      duration: (el?: Target) => Number((el as HTMLElement | undefined)?.dataset?.duration) ?? 16000,
      delay: (el?: Target) => Number((el as HTMLElement | undefined)?.dataset?.delay) ?? 0,
      loop: true,
      ease: "inOutSine",
    });
    return () => {
      a.pause();
    };
  }, [reduced, motes]);

  if (reduced) return null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {motes.map((m, i) => (
        <span
          key={i}
          data-mote
          data-drift={m.drift}
          data-opacity={m.opacity}
          data-duration={m.duration}
          data-delay={m.delay}
          className={cn(
            "absolute rounded-full",
            m.solar ? "bg-tower-accent-solar" : "bg-tower-text-primary",
          )}
          style={{ left: `${m.left}%`, bottom: 0, width: m.size, height: m.size, opacity: 0 }}
        />
      ))}
    </div>
  );
}
