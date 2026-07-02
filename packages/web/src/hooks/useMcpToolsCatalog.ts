"use client";

import { useCallback, useEffect, useState } from "react";
import type { McpToolCatalogEntry } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";

export function useMcpToolsCatalog() {
  const client = useTowerClient();
  const [tools, setTools] = useState<McpToolCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await client.listMcpTools();
      setTools(result.tools);
    } catch (err) {
      setTools([]);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { tools, loading, error, refresh };
}
