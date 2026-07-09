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
    setContext(undefined);
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
    let active = true;
    if (!threadId || !agentId) {
      setContext(undefined);
      setError(undefined);
      setLoading(false);
      return;
    }
    setContext(undefined);
    setError(undefined);
    setLoading(true);
    void client
      .getThreadAgentContext(threadId, agentId, 500)
      .then((result) => {
        if (active) setContext(result.context);
      })
      .catch((err) => {
        if (!active) return;
        setContext(undefined);
        setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, threadId, agentId]);

  return { context, loading, error, refresh };
}
