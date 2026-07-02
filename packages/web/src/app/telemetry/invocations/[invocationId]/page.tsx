import { InvocationDetailPageClient } from "@/components/telemetry/InvocationDetailPageClient";

// 单个 invocation 详情：各 agent 这轮加载的 skills + 用到的 MCP 工具，均可点跳详情。
export default async function InvocationDetailPage({
  params,
}: {
  params: Promise<{ invocationId: string }>;
}) {
  const { invocationId } = await params;
  return <InvocationDetailPageClient invocationId={invocationId} />;
}
