"use client";

import { Wifi, WifiOff, Circle, Check } from "lucide-react";
import { useHealth, type HealthStatus } from "@/hooks/useHealth";
import { useSseStore, type SseStatus } from "@/stores/sseStore";
import { cn } from "@/components/ui/cn";

/** 顶部指挥栏：brand / API target / health / SSE 状态。常驻于 AppShell。 */
export function TopCommandBar() {
  const health = useHealth();
  const sse = useSseStore((s) => s.status);
  const apiTarget = process.env.NEXT_PUBLIC_API_BASE_URL || "same-origin (proxied)";
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-tower-border-subtle bg-tower-bg-elevated px-4">
      <div className="flex flex-col leading-tight">
        <span className="text-[14px] font-bold tracking-wide text-tower-text-primary">TheTower</span>
        <span className="text-[11px] text-tower-text-muted">Multi-agent command</span>
      </div>
      <div className="ml-auto flex items-center gap-3 text-[12px]">
        <span className="text-tower-text-muted">
          API <span className="text-tower-text-secondary">{apiTarget}</span>
        </span>
        <HealthPill status={health} />
        <SsePill status={sse} />
      </div>
    </header>
  );
}

function HealthPill({ status }: { status: HealthStatus }) {
  const tone =
    status === "ok" ? "text-tower-link-ok" : status === "error" ? "text-tower-link-error" : "text-tower-link-warn";
  const Icon = status === "ok" ? Check : Circle;
  return (
    <span className={cn("inline-flex items-center gap-1", tone)}>
      <Icon size={13} />
      API {status}
    </span>
  );
}

function SsePill({ status }: { status: SseStatus }) {
  const tone =
    status === "connected" ? "text-tower-link-ok" : status === "error" ? "text-tower-link-error" : "text-tower-link-warn";
  const Icon = status === "connected" ? Wifi : WifiOff;
  return (
    <span className={cn("inline-flex items-center gap-1", tone)} title={`SSE ${status}`}>
      <Icon size={13} />
      SSE {status}
    </span>
  );
}
