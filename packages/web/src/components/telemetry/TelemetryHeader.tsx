"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TelemetryHeader({
  onRefresh,
  capability,
}: {
  onRefresh: () => void;
  capability?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-tower-border-subtle bg-tower-bg-elevated px-3 py-2">
      <h1 className="text-[15px] font-bold tracking-wide text-tower-text-primary">Telemetry</h1>
      <span className="text-[11px] text-tower-text-muted">跨线程观测与审计</span>
      {capability ? (
        <span className="rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-panel px-1.5 py-px text-[11px] text-tower-text-muted">
          events: {capability}
        </span>
      ) : null}
      <Button size="icon" variant="ghost" className="ml-auto" onClick={onRefresh} title="Refresh">
        <RefreshCw size={14} />
      </Button>
    </div>
  );
}
