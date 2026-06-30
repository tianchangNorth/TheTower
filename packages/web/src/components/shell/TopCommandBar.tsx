"use client";

import { Wifi, WifiOff, Circle, Check } from "lucide-react";
import { useHealth, type HealthStatus } from "@/hooks/useHealth";
import { cn } from "@/components/ui/cn";

/** 顶部指挥栏：brand / API target / health / SSE 占位。常驻于 AppShell。 */
export function TopCommandBar() {
  const health = useHealth();
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
        <SsePill />
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

/** SSE 状态占位 —— 真实 SSE 状态在 Phase 2 提升到 Shell 后接入。 */
function SsePill() {
  return (
    <span className="inline-flex items-center gap-1 text-tower-text-muted" title="SSE 状态在 Phase 2 提升到 Shell 后接入">
      <WifiOff size={13} />
      SSE —
    </span>
  );
}
