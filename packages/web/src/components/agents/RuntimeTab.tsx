"use client";

import type { AgentRuntimeConfigResponse } from "@the-tower/shared";
import { Placeholder } from "./Placeholder";

function value(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

export function RuntimeTab({ data }: { data?: AgentRuntimeConfigResponse }) {
  return (
    <Placeholder title="运行策略" note={data?.note ?? "加载中…"}>
      <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] gap-2 text-[12px]">
        <dt className="text-tower-text-muted">sandbox</dt>
        <dd className="m-0 text-tower-text-secondary">{value(data?.sandbox)}</dd>
        <dt className="text-tower-text-muted">approval</dt>
        <dd className="m-0 text-tower-text-secondary">{value(data?.approval)}</dd>
        <dt className="text-tower-text-muted">timeoutMs</dt>
        <dd className="m-0 text-tower-text-secondary">{value(data?.timeoutMs)}</dd>
        <dt className="text-tower-text-muted">tokenBudget</dt>
        <dd className="m-0 text-tower-text-secondary">{value(data?.tokenBudget)}</dd>
        <dt className="text-tower-text-muted">concurrency</dt>
        <dd className="m-0 text-tower-text-secondary">{value(data?.concurrency)}</dd>
      </dl>
    </Placeholder>
  );
}
