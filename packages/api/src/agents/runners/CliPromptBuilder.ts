import type { Agent, AgentRunInput, Message } from "../../types.js";

export function buildAgentPrompt(input: AgentRunInput): string {
  return [
    `你是多 Agent 平台中的一个 Agent。`,
    "",
    `Agent ID: ${input.agent.id}`,
    `Agent 名称: ${input.agent.displayName}`,
    `当前 threadId: ${input.threadId}`,
    `当前 invocationId: ${input.invocationId}`,
    "",
    "你的角色设定：",
    input.agent.rolePrompt || "无额外角色设定。",
    "",
    "当前协作状态：",
    formatInvocationState(input),
    "",
    "通信规则：",
    "- 你看到的是同一个 thread 的公开上下文，不是私聊。",
    "- 只有在需要把任务继续转交给其他 Agent 时，才在回复中写对应 mention。",
    "- A2A 转交必须把 mention 放在独立一行的行首，例如：@agent-b 请 review 这个实现。",
    "- 如果要让多个 Agent 分别行动，写多行行首 mention；平台会把这些行首 mention 路由给对应 Agent。",
    "- 确认、致谢、总结、已完成这类消息不要带任何 @mention。",
    "- 在普通说明文字里提到队友时，不要写 @handle；只有真实转交任务时才写 @handle。",
    "- 不要伪造其他 Agent 的发言。",
    "- 最终只输出你要写回 thread 的内容。",
    "",
    "A2A 球权检查：",
    "- @ = 球权转移。只有行首 @handle 会触发路由，句中 @handle 不会转移球权。",
    "- 回复前必须判断：这个任务到我这里是否已经结束？",
    "- 如果没有结束，找出下一位需要行动的 Agent，并在回复末尾单独一行使用行首 @handle 交接。",
    "- 如果这是接力、游戏、评审、实现链路等多人流程，完成自己部分后不要只输出结果；必须把球传给下一棒，或交回发起者收束。",
    "- 如果你是最后一棒，且原始任务要求发起者汇总或收束，请用行首 @handle 交回发起者。",
    "",
    "可协作 Agent 名册：",
    formatAgentDirectory(input.agent, input.availableAgents),
    "",
    "最近上下文：",
    formatMessages(input.messages),
  ].join("\n");
}

function formatInvocationState(input: AgentRunInput): string {
  const worklist = input.worklistAgents ?? [input.agent.id];
  const index = input.worklistIndex ?? Math.max(0, worklist.indexOf(input.agent.id));
  const mode = worklist.length > 1 ? "serial" : "solo";
  const lines = [`当前模式: ${mode}`];
  if (mode === "serial") {
    lines.push(`串行位置: ${index + 1}/${worklist.length}`);
    lines.push(`当前 worklist: ${worklist.join(" -> ")}`);
  }
  if (input.directMessageFrom) lines.push(`本轮由 ${input.directMessageFrom} 转交给你。`);
  lines.push(`A2A 是否可继续: ${input.a2aEnabled === false ? "否" : "是"}`);
  return lines.join("\n");
}

function formatAgentDirectory(currentAgent: Agent, agents: Agent[]): string {
  const peers = agents.filter((agent) => agent.enabled && agent.id !== currentAgent.id);
  if (peers.length === 0) return "(无可转交队友)";
  return peers
    .map((agent) => {
      const handles = agent.mentionHandles.join(" / ");
      const role = firstLine(agent.rolePrompt) || "无角色说明。";
      return `- ${agent.displayName} (${agent.id}): handles=${handles}; provider=${agent.provider}; model=${agent.model}; role=${role}`;
    })
    .join("\n");
}

function firstLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatMessages(messages: Message[]): string {
  if (messages.length === 0) return "(empty)";
  return messages
    .map((message, index) => {
      const sender =
        message.senderType === "agent" && message.senderId
          ? `agent:${message.senderId}`
          : message.senderType;
      const mentions = message.mentions.length > 0 ? ` mentions=${message.mentions.join(",")}` : "";
      return [
        `--- message ${index + 1} ---`,
        `id=${message.id} sender=${sender}${mentions} createdAt=${new Date(message.createdAt).toISOString()}`,
        message.content,
      ].join("\n");
    })
    .join("\n");
}
