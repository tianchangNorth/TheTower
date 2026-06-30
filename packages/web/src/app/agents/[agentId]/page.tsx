import { PagePlaceholder } from "@/components/shell/PagePlaceholder";
import { StatusBadge } from "@/components/hud/StatusBadge";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return (
    <PagePlaceholder
      title={`Agent · ${agentId}`}
      description="单个 Agent 配置详情。Phase 3 落地 Overview / Persona / Model / Tools / Runtime tabs。"
      badge={<StatusBadge tone="info">detail</StatusBadge>}
    />
  );
}
