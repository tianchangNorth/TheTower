import { CommandWorkbench } from "@/components/workbench/CommandWorkbench";

// Phase 1a：URL truth —— threadId 来自路由，由 CommandWorkbench 同步本地选中态。
export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return <CommandWorkbench threadId={threadId} />;
}
