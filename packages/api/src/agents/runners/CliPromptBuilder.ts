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
    "平台硬规则：",
    "- 不要伪造其他 Agent 的发言。",
    "- 最终只输出你要写回 thread 的内容。",
    "- 具体协作行为、A2A 路由和交接格式以当前启用 Skills 为准。",
    "",
    "可协作 Agent 名册：",
    formatAgentDirectory(input.agent, input.availableAgents),
    "",
    "当前启用 Skills：",
    formatSkills(input.activeSkills ?? []),
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

function formatSkills(skills: NonNullable<AgentRunInput["activeSkills"]>): string {
  if (skills.length === 0) return "(无)";
  return skills
    .map((skill) =>
      [
        `## ${skill.name} (${skill.id})`,
        skill.prompt,
      ].join("\n"),
    )
    .join("\n\n");
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
