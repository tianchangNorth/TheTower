"use client";

import { useCallback, useEffect, useState } from "react";
import type { DirListResponse } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";

export function useDirListing(path: string | undefined) {
  const client = useTowerClient();
  const [listing, setListing] = useState<DirListResponse | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setListing(await client.listDirs(path));
    } catch (err) {
      setListing(undefined);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client, path]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { listing, loading, error, refresh };
}
