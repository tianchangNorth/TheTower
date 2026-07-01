"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Agent,
  AgentAuditResponse,
  AgentRuntimeConfigResponse,
  AgentToolsResponse,
} from "@the-tower/shared";
import { useTowerClient } from "./useTowerClient";
import { useAgentConfigStore } from "@/stores/agentConfigStore";

export function useAgentConfig(agentId: string | undefined) {
  const client = useTowerClient();
  const init = useAgentConfigStore((s) => s.init);
  const patch = useAgentConfigStore((s) => s.patch);
  const setSaving = useAgentConfigStore((s) => s.setSaving);
  const setSaved = useAgentConfigStore((s) => s.setSaved);
  const setError = useAgentConfigStore((s) => s.setError);

  const entry = useAgentConfigStore((s) => (agentId ? s.drafts[agentId] : undefined));
  const status = useAgentConfigStore((s) => (agentId ? s.status[agentId] ?? "idle" : "idle"));
  const error = useAgentConfigStore((s) => (agentId ? s.error[agentId] : undefined));

  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | undefined>();
  const [tools, setTools] = useState<AgentToolsResponse | undefined>();
  const [runtime, setRuntime] = useState<AgentRuntimeConfigResponse | undefined>();
  const [audit, setAudit] = useState<AgentAuditResponse | undefined>();

  const refresh = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setFetchError(undefined);
    try {
      const [cfg, t, r, a] = await Promise.all([
        client.getAgentConfig(agentId),
        client.getAgentTools(agentId).catch(() => undefined),
        client.getAgentRuntime(agentId).catch(() => undefined),
        client.getAgentAudit(agentId).catch(() => undefined),
      ]);
      init(cfg.agent);
      if (t) setTools(t);
      if (r) setRuntime(r);
      if (a) setAudit(a);
    } catch (err) {
      setFetchError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [agentId, client, init]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 保存配置草稿；成功后刷新 original/working，失败设 error。 */
  const save = useCallback(
    async (patchInput: Partial<Agent>): Promise<Agent | undefined> => {
      if (!agentId) return undefined;
      setSaving(agentId);
      try {
        const res = await client.updateAgentConfig(agentId, patchInput);
        setSaved(agentId, res.agent);
        return res.agent;
      } catch (err) {
        setError(agentId, (err as Error).message);
        throw err;
      }
    },
    [agentId, client, setSaving, setSaved, setError],
  );

  return { entry, status, error, loading, fetchError, tools, runtime, audit, refresh, save, patch };
}
