"use client";

import { useCallback, useEffect, useState } from "react";
import type { ThreadTelemetryContextResponse } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";

export function useThreadContext(threadId: string | undefined) {
  const client = useTowerClient();
  const [context, setContext] = useState<ThreadTelemetryContextResponse | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    if (!threadId) {
      setContext(undefined);
      setError(undefined);
      return;
    }
    setContext(undefined);
    setLoading(true);
    setError(undefined);
    try {
      setContext(await client.getThreadTelemetryContext(threadId));
    } catch (err) {
      setContext(undefined);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client, threadId]);

  useEffect(() => {
    let active = true;
    if (!threadId) {
      setContext(undefined);
      setError(undefined);
      setLoading(false);
      return;
    }
    setContext(undefined);
    setError(undefined);
    setLoading(true);
    void client
      .getThreadTelemetryContext(threadId)
      .then((result) => {
        if (active) setContext(result);
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
  }, [client, threadId]);

  return { context, loading, error, refresh };
}
