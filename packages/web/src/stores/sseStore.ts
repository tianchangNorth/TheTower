"use client";

import { create } from "zustand";

export type SseStatus = "connecting" | "connected" | "error";

interface SseState {
  status: SseStatus;
  setStatus: (status: SseStatus) => void;
}

/** 全局 SSE 连接状态，供 TopCommandBar 与 CommandShell 共享。 */
export const useSseStore = create<SseState>((set) => ({
  status: "connecting",
  setStatus: (status) => set({ status }),
}));
