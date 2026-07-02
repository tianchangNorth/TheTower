import type { AgentEvent, AgentRunInput, AgentRunner } from "../../types.js";

export class MockRunner implements AgentRunner {
  async *run(input: AgentRunInput): AsyncIterable<AgentEvent> {
    const latest = input.messages.at(-1);
    const directFrom = findDirectSender(input.messages, input.agent.id);
    const persona = input.agent.persona;
    const signature = persona.signature ?? `[${input.agent.displayName}/${input.agent.model}🐾]`;
    const prefix = directFrom ? `收到 ${directFrom} 的转交。` : "收到任务。";
    const latestSummary = latest
      ? `上一条消息来自 ${latest.senderId ?? latest.senderType}。`
      : "暂无上下文消息。";
    const content = `${prefix}我是 ${input.agent.displayName}，${persona.roleDescription}。已读取 ${input.messages.length} 条上下文。${latestSummary} ${signature}`;
    yield {
      type: "thinking",
      content: `分析最新消息：${latestSummary}`,
    };
    yield {
      type: "stream_text",
      content: `正在组织回复，已读取 ${input.messages.length} 条上下文。`,
    };
    yield {
      type: "text",
      content,
    };
    yield {
      type: "token_usage",
      usage: {
        inputTokens: 100 + input.messages.length * 25,
        outputTokens: Math.max(1, Math.ceil(content.length / 4)),
        contextWindowSize: 128_000,
        lastTurnInputTokens: 100 + input.messages.length * 25,
        budgetTokens: 128_000,
        source: "provider",
      },
    };
    yield { type: "done" };
  }
}

function findDirectSender(messages: AgentRunInput["messages"], agentId: string): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.mentions.includes(agentId) && msg.senderType === "agent" && msg.senderId) {
      return msg.senderId;
    }
  }
  return undefined;
}
