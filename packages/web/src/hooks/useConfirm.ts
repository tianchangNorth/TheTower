"use client";

import { useConfirmStore } from "@/stores/confirmStore";
import type { ConfirmOptions } from "@/stores/confirmStore";

/** 全局确认弹窗触发器：const confirm = useConfirm(); await confirm({...}); */
export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return useConfirmStore((s) => s.openConfirm);
}
