"use client";

import { useCallback, useEffect, useState } from "react";
import type { McpToolDetail } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";

export function useMcpToolDetail(toolName: string | undefined) {
  const client = useTowerClient();
  const [tool, setTool] = useState<McpToolDetail | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    if (!toolName) {
      setTool(undefined);
      setError(undefined);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const result = await client.getMcpTool(toolName);
      setTool(result.tool);
    } catch (err) {
      setTool(undefined);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client, toolName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { tool, loading, error, refresh };
}
