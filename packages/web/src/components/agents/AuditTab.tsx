"use client";

import type { AgentAuditResponse } from "@the-tower/shared";
import { Placeholder } from "./Placeholder";

export function AuditTab({ data }: { data?: AgentAuditResponse }) {
  return (
    <Placeholder title="审计" note={data?.note ?? "加载中…"}>
      <div className="grid gap-2 text-[12px]">
        <section>
          <h4 className="m-0 mb-1 font-bold uppercase text-tower-text-secondary">最近错误</h4>
          {data?.recentErrors.length ? (
            <ul className="m-0 grid gap-1">
              {data.recentErrors.map((e, i) => (
                <li key={i} className="text-tower-text-secondary">
                  {e.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-tower-text-muted">—</p>
          )}
        </section>
        <section>
          <h4 className="m-0 mb-1 font-bold uppercase text-tower-text-secondary">配置变更</h4>
          {data?.configChanges.length ? (
            <ul className="m-0 grid gap-1">
              {data.configChanges.map((e, i) => (
                <li key={i} className="text-tower-text-secondary">
                  {e.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-tower-text-muted">—</p>
          )}
        </section>
      </div>
    </Placeholder>
  );
}
