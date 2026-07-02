import { McpToolDetailPageClient } from "@/components/capabilities/McpToolDetailPageClient";

// 单个 MCP 工具详情：name / title / description + 参数表（含嵌套）。
export default async function McpToolDetailPage({
  params,
}: {
  params: Promise<{ toolName: string }>;
}) {
  const { toolName } = await params;
  return <McpToolDetailPageClient toolName={toolName} />;
}
