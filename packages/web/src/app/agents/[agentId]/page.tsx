import { AgentDetailPageClient } from "@/components/agents/AgentDetailPageClient";

// 单个 Agent 配置详情：Overview / Persona / Model / Tools / Runtime / Audit。
export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return <AgentDetailPageClient agentId={agentId} />;
}
