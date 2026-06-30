import type { AgentTokenUsage, AgentWorkStatus } from "@the-tower/shared";

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
  const used = usage.totalTokens ?? sumDefined(usage.inputTokens, usage.outputTokens, usage.reasoningTokens);
  if (used === undefined) return "Token --";
  if (usage.budgetTokens !== undefined) {
    return `Token ${formatTokenCount(used)} / ${formatTokenCount(usage.budgetTokens)}`;
  }
  return `Token ${formatTokenCount(used)}`;
}

export function formatRemainingTokens(usage: AgentTokenUsage | undefined): string | undefined {
  if (!usage || usage.source === "unavailable" || usage.remainingTokens === undefined) return undefined;
  return `剩余 ${formatTokenCount(usage.remainingTokens)}`;
}

export function statusDotClass(status: AgentWorkStatus): string {
  switch (status) {
    case "thinking":
      return "bg-[#2f6fbe] animate-pulse";
    case "tool_calling":
    case "alive_but_silent":
      return "bg-[#b7791f] animate-pulse";
    case "replying":
    case "done":
      return "bg-[#1f7a53] animate-pulse";
    case "suspected_stall":
      return "bg-[#c05621] animate-pulse";
    case "error":
      return "bg-[#b4232a]";
    case "idle":
      return "bg-[#a4afb3]";
  }
}

export function statusPillClass(status: AgentWorkStatus): string {
  switch (status) {
    case "thinking":
      return "border-[#b7d0ee] bg-[#eef6ff]";
    case "tool_calling":
    case "alive_but_silent":
      return "border-[#ead19f] bg-[#fff8e8]";
    case "replying":
    case "done":
      return "border-[#b9dfcc] bg-[#eefaf3]";
    case "suspected_stall":
      return "border-[#edbe9d] bg-[#fff3ea]";
    case "error":
      return "border-[#efb5b5] bg-[#fff1f1]";
    case "idle":
      return "border-[#d8e0e2] bg-white";
  }
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
