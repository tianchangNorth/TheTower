import type { Agent, AgentRunInput, Message } from "../../types.js";

export interface AgentPromptParts {
  /** 稳定身份/铁律/名册/工具能力 —— 走 system 通道（claude --append-system-prompt）。 */
  system: string;
  /** 动态调用上下文/skills/消息 —— 走 user 通道（stdin）。 */
  user: string;
}

/**
 * 为一次 agent 调用构建分段 prompt。
 * 参照 clowder-ai SystemPromptBuilder：身份锚点极短（~150-200 tokens），
 * 稳定部分进 system，动态部分进 user，靠签名 🐾 锚定身份降低"AI 助手腔"。
 */
export function buildAgentPromptParts(
  input: AgentRunInput,
  opts: { providerToolDoc?: string } = {},
): AgentPromptParts {
  return {
    system: buildSystemPrompt(input, opts.providerToolDoc),
    user: buildUserPrompt(input),
  };
}

function buildSystemPrompt(input: AgentRunInput, providerToolDoc?: string): string {
  const { agent } = input;
  const persona = agent.persona;
  const handles = agent.mentionHandles.join(" / ");
  const signature = persona.signature ?? `[${agent.displayName}/${agent.model}🐾]`;

  const backgroundLine = persona.background ? `${persona.background}\n` : "";
  const voiceLine = persona.voice?.instruct ? `语气：${persona.voice.instruct}。\n` : "";
  const quirksLine = persona.quirks?.length ? `习惯：${persona.quirks.join("；")}。\n` : "";

  const sections: string[] = [];

  // S1 身份声明
  sections.push(
    [
      `你是 ${agent.displayName}（${handles}，id=${agent.id}），TheTower 多 Agent 平台的 Agent。`,
      backgroundLine,
      `角色：${persona.roleDescription}`,
      `性格：${persona.personality}`,
      voiceLine + quirksLine,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  // S2 能力与边界
  sections.push(
    [
      `擅长：${persona.strengths.join("、") || "（未指定）"}`,
      `硬限制：${persona.restrictions.join("、") || "（无）"}。被 @ 做这类任务时 push back 或退回给 @ 你的 Agent。`,
    ].join("\n"),
  );

  // S3 平台铁律
  sections.push(
    [
      "平台铁律：",
      "- 不要伪造其他 Agent 的发言。",
      `- 用第一人称视角说话，你就是 ${agent.displayName} 本人，不是"AI 助手"。`,
      `- 人类用户是你的“Guardian”（守护者），称呼他们为 Guardian，不要用“用户/亲/您”这类泛称。`,
      `- 每条回复末尾带签名 ${signature}。`,
      "- 最终只输出你要写回 thread 的内容。",
      "- 具体协作行为、A2A 路由和交接格式以当前启用 Skills 为准。",
      "- @ 是路由指令不是装饰；收到 @ 后接 / 退 / 升三选一。",
    ].join("\n"),
  );

  // S4 协作名册
  const directory = formatAgentDirectory(agent, input.availableAgents);
  if (directory) {
    sections.push(`可协作 Agent 名册：\n${directory}`);
  }

  // S5 provider 工具能力（可选，由 runner 注入）
  if (providerToolDoc) {
    sections.push(providerToolDoc);
  }

  return sections.join("\n\n");
}

function buildUserPrompt(input: AgentRunInput): string {
  return [
    "当前调用上下文：",
    formatInvocationState(input),
    "",
    "当前启用 Skills：",
    formatSkills(input.activeSkills ?? []),
    "",
    "最近上下文：",
    formatMessages(input.messages, input.agent.id),
  ].join("\n");
}

function formatInvocationState(input: AgentRunInput): string {
  const worklist = input.worklistAgents ?? [input.agent.id];
  const index = input.worklistIndex ?? Math.max(0, worklist.indexOf(input.agent.id));
  const routeMode = input.routeMode ?? (worklist.length > 1 ? "fanout" : "single");
  const remainingAgents = input.remainingAgents ?? worklist.slice(index + 1);
  const lines = [
    `threadId: ${input.threadId}`,
    `invocationId: ${input.invocationId}`,
    `当前 routeMode: ${routeMode}`,
  ];
  if (worklist.length > 1) {
    lines.push(`串行位置: ${index + 1}/${worklist.length}`);
    lines.push(`当前 worklist: ${worklist.join(" -> ")}`);
    lines.push(`remainingAgents: ${remainingAgents.length > 0 ? remainingAgents.join(" -> ") : "(none)"}`);
  }
  if (routeMode === "fanout" || routeMode === "parallel") {
    lines.push("本模式下你只完成自己的部分；不要 @ 当前 worklist 中等待执行的 Agent。");
  }
  if (input.directMessageFrom) lines.push(`本轮由 ${input.directMessageFrom} 转交给你。`);
  lines.push(`A2A 是否可继续: ${input.a2aEnabled === false ? "否" : "是"}`);
  return lines.join("\n");
}

function formatAgentDirectory(currentAgent: Agent, agents: Agent[]): string | null {
  const peers = agents.filter((agent) => agent.enabled && agent.id !== currentAgent.id);
  if (peers.length === 0) return null;
  return peers
    .map((agent) => {
      const handles = agent.mentionHandles.join(" / ");
      const strengths = agent.persona.strengths.join("、") || agent.persona.roleDescription;
      return `- ${agent.displayName} (${agent.id}): handles=${handles}; 擅长=${strengths}`;
    })
    .join("\n");
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

function formatMessages(messages: Message[], currentAgentId: string): string {
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
        formatHandoffPayload(message, currentAgentId),
      ].join("\n");
    })
    .join("\n");
}

function formatHandoffPayload(message: Message, currentAgentId: string): string {
  const payload = message.handoffPayload;
  if (!payload || !payload.toAgentIds.includes(currentAgentId)) return "";

  const lines = [
    "",
    "本轮结构化交接上下文：",
    `- From: ${payload.fromAgentId}`,
    `- To: ${payload.toAgentIds.join(", ")}`,
    `- What: ${payload.what}`,
    `- Why: ${payload.why}`,
    `- Tradeoff: ${payload.tradeoff}`,
    `- Next Action: ${payload.nextAction}`,
  ];
  if (payload.openQuestions.length > 0) {
    lines.push(`- Open Questions: ${payload.openQuestions.join(" | ")}`);
  }
  if (payload.evidenceRefs && payload.evidenceRefs.length > 0) {
    lines.push(
      `- Evidence: ${payload.evidenceRefs
        .map((ref) => `${ref.kind}:${ref.ref}${ref.note ? ` (${ref.note})` : ""}`)
        .join(" | ")}`,
    );
  }
  if (payload.riskLevel) lines.push(`- Risk: ${payload.riskLevel}`);

  return lines.join("\n");
}
