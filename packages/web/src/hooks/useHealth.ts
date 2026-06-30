"use client";

import { useEffect, useState } from "react";

export type HealthStatus = "checking" | "ok" | "error";

/** 轻量轮询 /health，供 Shell 顶部状态条使用。 */
export function useHealth(path = "/health", intervalMs = 15000): HealthStatus {
  const [status, setStatus] = useState<HealthStatus>("checking");
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (!alive) return;
        setStatus(res.ok ? "ok" : "error");
      } catch {
        if (alive) setStatus("error");
      }
    };
    void check();
    const id = setInterval(check, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [path, intervalMs]);
  return status;
}
