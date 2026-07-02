"use client";

import { useCallback, useEffect, useState } from "react";
import type { InvocationInspectResponse } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";

export function useInvocationInspect(invocationId: string | undefined) {
  const client = useTowerClient();
  const [inspect, setInspect] = useState<InvocationInspectResponse | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    if (!invocationId) {
      setInspect(undefined);
      setError(undefined);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      setInspect(await client.getInvocationInspect(invocationId));
    } catch (err) {
      setInspect(undefined);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client, invocationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { inspect, loading, error, refresh };
}
