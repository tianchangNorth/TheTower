import type { AgentTokenUsage, AgentWorkStatus } from "@the-tower/shared";
import type { StatusBadgeProps } from "@/components/hud/StatusBadge";

export type StatusTone = NonNullable<StatusBadgeProps["tone"]>;

/** Agent 工作状态 → StatusBadge tone（semantic token 映射）。 */
export function statusTone(status: AgentWorkStatus): StatusTone {
  switch (status) {
    case "thinking":
      return "thinking";
    case "tool_calling":
      return "tool-calling";
    case "replying":
      return "replying";
    case "alive_but_silent":
      return "tool-calling";
    case "suspected_stall":
      return "stall";
    case "done":
      return "done";
    case "error":
      return "error";
    case "idle":
      return "idle";
  }
}

/** 状态点颜色，走 semantic 状态 token。 */
export function statusDotClass(status: AgentWorkStatus): string {
  switch (status) {
    case "thinking":
      return "bg-tower-status-thinking";
    case "tool_calling":
    case "alive_but_silent":
      return "bg-tower-status-tool-calling";
    case "replying":
    case "done":
      return "bg-tower-status-done";
    case "suspected_stall":
      return "bg-tower-status-suspected-stall";
    case "error":
      return "bg-tower-status-error";
    case "idle":
      return "bg-tower-status-idle";
  }
}

export function formatAgentStatusLabel(status: AgentWorkStatus): string {
  switch (status) {
    case "thinking":
      return "思考中";
    case "tool_calling":
      return "工具调用";
    case "replying":
      return "回复中";
    case "alive_but_silent":
      return "静默运行";
    case "suspected_stall":
      return "疑似卡住";
    case "done":
      return "完成";
    case "error":
      return "异常";
    case "idle":
      return "空闲";
  }
}

export function formatToolName(toolName: string | undefined): string | undefined {
  if (!toolName) return undefined;
  const labels: Record<string, string> = {
    read_file: "读文件",
    read_file_slice: "读文件片段",
    list_files: "列文件",
    write_file: "写文件",
    shell_exec: "执行命令",
    post_message: "发送消息",
  };
  return labels[toolName] ?? toolName;
}

export function formatTokenUsage(usage: AgentTokenUsage | undefined): string {
  if (!usage || usage.source === "unavailable") return "Token --";
  const contextUsed = resolveContextUsedTokens(usage);
  const contextWindow = usage.contextWindowSize ?? usage.budgetTokens;
  if (contextUsed !== undefined && contextWindow !== undefined) {
    return `Context ${formatTokenCount(contextUsed)} / ${formatTokenCount(contextWindow)}`;
  }
  if (usage.inputTokens !== undefined || usage.outputTokens !== undefined) {
    const input = usage.inputTokens !== undefined ? `In ${formatTokenCount(usage.inputTokens)}` : undefined;
    const output = usage.outputTokens !== undefined ? `Out ${formatTokenCount(usage.outputTokens)}` : undefined;
    return [input, output].filter(Boolean).join(" · ");
  }
  if (usage.totalTokens !== undefined) {
    return usage.isCumulativeUsage
      ? `Total ${formatTokenCount(usage.totalTokens)} cumulative`
      : `Total ${formatTokenCount(usage.totalTokens)}`;
  }
  return "Token --";
}

export function formatRemainingTokens(usage: AgentTokenUsage | undefined): string | undefined {
  if (!usage || usage.source === "unavailable" || usage.remainingTokens === undefined) return undefined;
  return `剩余 ${formatTokenCount(usage.remainingTokens)}`;
}

export function formatUsageDetail(usage: AgentTokenUsage | undefined): string | undefined {
  if (!usage || usage.source === "unavailable") return undefined;
  const parts = [
    usage.inputTokens !== undefined ? `In ${formatTokenCount(usage.inputTokens)}` : undefined,
    usage.outputTokens !== undefined ? `Out ${formatTokenCount(usage.outputTokens)}` : undefined,
    usage.cacheReadTokens !== undefined ? `Cache ${formatTokenCount(usage.cacheReadTokens)}` : undefined,
    usage.reasoningTokens !== undefined ? `Reasoning ${formatTokenCount(usage.reasoningTokens)}` : undefined,
    usage.costUsd !== undefined ? `Cost $${usage.costUsd.toFixed(usage.costUsd < 0.01 ? 4 : 2)}` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function sumDefined(...values: Array<number | undefined>): number | undefined {
  const present = values.filter((value): value is number => value !== undefined);
  if (present.length === 0) return undefined;
  return present.reduce((sum, value) => sum + value, 0);
}

function resolveContextUsedTokens(usage: AgentTokenUsage): number | undefined {
  if (usage.contextUsedTokens !== undefined) return usage.contextUsedTokens;
  if (
    usage.lastTurnInputTokens !== undefined &&
    usage.contextWindowSize !== undefined &&
    usage.lastTurnInputTokens <= usage.contextWindowSize
  ) {
    return usage.lastTurnInputTokens;
  }
  if (usage.isCumulativeUsage) return undefined;
  if (
    usage.inputTokens !== undefined &&
    usage.contextWindowSize !== undefined &&
    usage.inputTokens <= usage.contextWindowSize
  ) {
    return usage.inputTokens;
  }
  return undefined;
}

// 保留旧名导出以兼容未被引用的引用点；sumDefined 暂无外部使用。
export { sumDefined };
