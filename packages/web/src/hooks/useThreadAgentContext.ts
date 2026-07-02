"use client";

import { useCallback, useEffect, useState } from "react";
import type { ThreadAgentContextResponse } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";

export function useThreadAgentContext(threadId: string | undefined, agentId: string | undefined) {
  const client = useTowerClient();
  const [context, setContext] = useState<ThreadAgentContextResponse | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    if (!threadId || !agentId) {
      setContext(undefined);
      setError(undefined);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const result = await client.getThreadAgentContext(threadId, agentId, 500);
      setContext(result.context);
    } catch (err) {
      setContext(undefined);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client, threadId, agentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { context, loading, error, refresh };
}
