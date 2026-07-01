"use client";

import type { AgentToolsResponse } from "@the-tower/shared";
import { Placeholder } from "./Placeholder";

export function ToolsTab({ data }: { data?: AgentToolsResponse }) {
  return (
    <Placeholder
      title="工具权限矩阵"
      note={data?.note ?? "加载中…"}
    >
      <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] gap-2 text-[12px]">
        <dt className="text-tower-text-muted">enabledTools</dt>
        <dd className="m-0 text-tower-text-secondary">
          {data?.enabledTools.length ? data.enabledTools.join(", ") : "—"}
        </dd>
        <dt className="text-tower-text-muted">mcpServers</dt>
        <dd className="m-0 text-tower-text-secondary">
          {data?.mcpServers.length ? data.mcpServers.join(", ") : "—"}
        </dd>
      </dl>
    </Placeholder>
  );
}
