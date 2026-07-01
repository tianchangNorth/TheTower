import { CommandShell } from "@/components/command/CommandShell";

// URL truth：threadId 来自路由，由 CommandShell 同步 thread-scoped store。
export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return <CommandShell threadId={threadId} />;
}
