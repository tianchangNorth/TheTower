"use client";

import { useCallback, useEffect, useState } from "react";
import type { SkillDefinition } from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";

export function useSkillDetail(skillId: string | undefined) {
  const client = useTowerClient();
  const [skill, setSkill] = useState<SkillDefinition | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    if (!skillId) {
      setSkill(undefined);
      setError(undefined);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const result = await client.getSkill(skillId);
      setSkill(result.skill);
    } catch (err) {
      setSkill(undefined);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client, skillId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { skill, loading, error, refresh };
}
