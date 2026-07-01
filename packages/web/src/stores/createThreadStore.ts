"use client";

import { create } from "zustand";

interface CreateThreadState {
  open: boolean;
  openCreateThread: () => void;
  close: () => void;
}

/** 全局「新建 Thread」弹窗开关，供 HomePage CTA 与 ThreadNavigator 共用。 */
export const useCreateThreadStore = create<CreateThreadState>((set) => ({
  open: false,
  openCreateThread: () => set({ open: true }),
  close: () => set({ open: false }),
}));
