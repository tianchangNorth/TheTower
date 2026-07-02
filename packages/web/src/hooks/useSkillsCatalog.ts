"use client";

import { useCallback, useEffect, useState } from "react";
import type { SkillManifest } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";

export function useSkillsCatalog() {
  const client = useTowerClient();
  const [skills, setSkills] = useState<SkillManifest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await client.listSkills();
      setSkills(result.skills);
    } catch (err) {
      setSkills([]);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { skills, loading, error, refresh };
}
