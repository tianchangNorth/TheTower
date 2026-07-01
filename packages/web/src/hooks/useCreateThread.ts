"use client";

import { useCreateThreadStore } from "@/stores/createThreadStore";

/** 触发全局新建 Thread 弹窗：const openCreateThread = useCreateThread(); openCreateThread(); */
export function useCreateThread(): () => void {
  return useCreateThreadStore((s) => s.openCreateThread);
}
