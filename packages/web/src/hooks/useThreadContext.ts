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
    void refresh();
  }, [refresh]);

  return { context, loading, error, refresh };
}
