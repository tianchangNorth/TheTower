"use client";

import { useMemo } from "react";
import { TheTowerClient } from "@the-tower/sdk";

// 同源客户端，经 next.config.ts rewrites 代理到后端。Phase 2 取消可编辑 apiBase，统一同源。
export function useTowerClient(): TheTowerClient {
  return useMemo(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    return new TheTowerClient({ baseUrl });
  }, []);
}
