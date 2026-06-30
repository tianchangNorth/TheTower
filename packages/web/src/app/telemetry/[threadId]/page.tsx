import { PagePlaceholder } from "@/components/shell/PagePlaceholder";
import { StatusBadge } from "@/components/hud/StatusBadge";

export default async function ThreadTelemetryPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return (
    <PagePlaceholder
      title={`Telemetry · ${threadId}`}
      description="指定 thread 的观测入口。Phase 4 落地该 thread 的 invocation / event / tool audit / context 聚合视图。"
      badge={<StatusBadge tone="info">detail</StatusBadge>}
    />
  );
}
