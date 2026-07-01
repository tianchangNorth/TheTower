"use client";

import { useRouter } from "next/navigation";
import { useCreateThreadStore } from "@/stores/createThreadStore";
import { CreateThreadDialog } from "./CreateThreadDialog";

/** 全局新建 Thread 弹窗 Provider：root layout 挂载一次，onCreated 导航到 /threads/[id]。 */
export function CreateThreadDialogProvider() {
  const open = useCreateThreadStore((s) => s.open);
  const close = useCreateThreadStore((s) => s.close);
  const router = useRouter();

  return (
    <CreateThreadDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      onCreated={(thread) => {
        close();
        router.push(`/threads/${thread.id}`);
      }}
    />
  );
}
