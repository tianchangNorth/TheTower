"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * 原创 Destiny 2 风格动态徽记（不使用任何版权素材）。
 * 多层几何（六边形 / 三角 / 倒三角）+ 雷达扫描线，anime.js 驱动：
 * 常驻旋转 + 入场 stroke-draw + 中心呼吸。遵守 prefers-reduced-motion。
 */
const ROTATE_STYLE = { transformBox: "view-box" as const, transformOrigin: "center" as const };

export function DestinyEmblem({ className }: { className?: string }) {
  const rootRef = useRef<SVGSVGElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const svg = rootRef.current;
    if (!svg || reduced) return;

    const outer = svg.querySelector("[data-layer='outer']");
    const inner = svg.querySelector("[data-layer='inner']");
    const mid = svg.querySelector("[data-layer='mid']");
    const scan = svg.querySelector("[data-layer='scan']");
    const dot = svg.querySelector("[data-layer='dot']");

    // 常驻旋转
    if (outer) animate(outer, { rotate: 360, duration: 24000, loop: true, easing: "linear" });
    if (mid) animate(mid, { rotate: -360, duration: 16000, loop: true, easing: "linear" });
    if (inner) animate(inner, { rotate: 360, duration: 9000, loop: true, easing: "linear" });
    if (scan) animate(scan, { rotate: 360, duration: 3600, loop: true, easing: "linear" });

    // 入场 stroke-draw
    const draws = Array.from(svg.querySelectorAll("[data-draw]")) as SVGGeometryElement[];
    draws.forEach((el) => {
      const len = typeof el.getTotalLength === "function" ? el.getTotalLength() : 200;
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
    });
    if (draws.length) {
      animate(draws, {
        strokeDashoffset: 0,
        duration: 1400,
        delay: stagger(160),
        easing: "easeOutQuad",
      });
    }

    // 中心呼吸
    if (dot) {
      animate(dot, {
        scale: [1, 1.35, 1],
        opacity: [0.7, 1, 0.7],
        duration: 1800,
        loop: true,
        ease: "inOutSine",
      });
    }
  }, [reduced]);

  return (
    <svg
      ref={rootRef}
      viewBox="-50 -50 100 100"
      className={className}
      role="img"
      aria-label="TheTower emblem"
    >
      <g data-layer="outer" style={ROTATE_STYLE}>
        <polygon
          data-draw
          points="42,0 21,36.37 -21,36.37 -42,0 -21,-36.37 21,-36.37"
          className="fill-none stroke-tower-accent-arc"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </g>
      <g data-layer="mid" style={ROTATE_STYLE}>
        <polygon
          data-draw
          points="0,28 -24.25,-14 24.25,-14"
          className="fill-none stroke-tower-accent-arc/70"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </g>
      <g data-layer="inner" style={ROTATE_STYLE}>
        <polygon
          data-draw
          points="0,-14 12.12,7 -12.12,7"
          className="fill-none stroke-tower-accent-solar"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </g>
      <g data-layer="scan" style={ROTATE_STYLE}>
        <line x1={0} y1={0} x2={0} y2={-40} className="stroke-tower-accent-solar/60" strokeWidth={1} />
        <circle cx={0} cy={-40} r={2.5} className="fill-tower-accent-solar" />
      </g>
      <circle data-layer="dot" cx={0} cy={0} r={3} className="fill-tower-accent-arc" style={ROTATE_STYLE} />
    </svg>
  );
}
