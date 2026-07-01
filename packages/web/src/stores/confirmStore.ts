"use client";

import { create } from "zustand";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 危险动作（删除）使用 danger 色。 */
  danger?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  /** 弹出确认框，返回用户选择（true=确认 / false=取消）。 */
  openConfirm: (options: ConfirmOptions) => Promise<boolean>;
  close: (value: boolean) => void;
}

/** 全局确认弹窗状态。由 ConfirmDialogProvider 渲染，useConfirm 暴露触发方法。 */
export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolve: null,
  openConfirm: (options) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, options, resolve });
    }),
  close: (value) => {
    const resolve = get().resolve;
    if (resolve) resolve(value);
    set({ open: false, resolve: null });
  },
}));
