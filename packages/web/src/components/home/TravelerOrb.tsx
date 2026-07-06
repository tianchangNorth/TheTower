"use client";

import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { cn } from "@/components/ui/cn";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const ROTATE_STYLE = {
  transformBox: "view-box" as const,
  transformOrigin: "center" as const,
};

/**
 * 旅人白球 + 体积光（god rays）。背景层，置于 Hero section 内。
 * 径向渐变：核心 text-primary 近白蓝 → arc 冷蓝辉光 → 透明。
 * 悬浮呼吸（8s，不旋转），体积光 30s 极慢摆动。遵守 reduced-motion。
 * 全部引用现有 token，零新增 hex。
 */
export function TravelerOrb({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const orb = root.querySelector<HTMLElement>("[data-orb]");
    const float = root.querySelector<HTMLElement>("[data-orb-float]");
    const rays = root.querySelector<SVGSVGElement>("[data-rays]");
    const raysRotate = root.querySelector<SVGGElement>("[data-rays-rotate]");

    if (reduced) {
      if (orb) orb.style.opacity = "1";
      if (rays) rays.style.opacity = "1";
      return;
    }

    const anims: Array<{ pause: () => void }> = [];

    // 旅人球入场：opacity + scale，1200ms
    if (orb) {
      anims.push(
        animate(orb, {
          opacity: [0, 1],
          scale: [0.92, 1],
          duration: 1200,
          ease: "outQuad",
        }),
      );
    }
    // 悬浮呼吸：translateY 三关键帧来回，8s loop，不旋转
    if (float) {
      anims.push(
        animate(float, {
          translateY: [-4, 4, -4],
          duration: 8000,
          loop: true,
          ease: "inOutSine",
          delay: 1200,
        }),
      );
    }
    // 体积光入场：opacity，200ms delay
    if (rays) {
      anims.push(
        animate(rays, {
          opacity: [0, 1],
          duration: 1000,
          ease: "outQuad",
          delay: 200,
        }),
      );
    }
    // 体积光慢摆：rotate ±3°，30s loop
    if (raysRotate) {
      anims.push(
        animate(raysRotate, {
          rotate: [-3, 3, -3],
          duration: 30000,
          loop: true,
          ease: "inOutSine",
          delay: 1200,
        }),
      );
    }

    return () => anims.forEach((a) => a.pause());
  }, [reduced]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 z-0 select-none", className)}
    >
      {/* 体积光 god rays：SVG 锥形光束，arc 低透明 + screen 混合 */}
      <svg
        data-rays
        viewBox="-100 -100 200 200"
        className="absolute -right-25 -top-25 h-90 w-90"
        style={{ opacity: 0, mixBlendMode: "screen" }}
      >
        <g data-rays-rotate style={ROTATE_STYLE} className="fill-tower-accent-arc/12">
          <polygon points="0,0 -5,-95 5,-95" transform="rotate(-20)" />
          <polygon points="0,0 -4,-95 4,-95" transform="rotate(-10)" />
          <polygon points="0,0 -6,-95 6,-95" />
          <polygon points="0,0 -4,-95 4,-95" transform="rotate(10)" />
          <polygon points="0,0 -5,-95 5,-95" transform="rotate(20)" />
        </g>
      </svg>

      {/* 旅人球本体 */}
      <div
        data-orb
        className="absolute -right-10 -top-10 h-60 w-60"
        style={{ opacity: 0 }}
      >
        <div data-orb-float className="relative h-full w-full">
          {/* 核心球：近白蓝核心 → arc 辉光 → 透明 */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, var(--color-tower-text-primary) 0%, var(--color-tower-accent-arc) 55%, transparent 75%)",
            }}
          />
          {/* 外圈辉光：arc 第二层，screen 混合，放大 */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, var(--color-tower-accent-arc) 0%, transparent 70%)",
              opacity: 0.25,
              mixBlendMode: "screen",
              transform: "scale(1.6)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
