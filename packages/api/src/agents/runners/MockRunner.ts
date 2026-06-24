import type { AgentEvent, AgentRunInput, AgentRunner } from "../../types.js";

export class MockRunner implements AgentRunner {
  async *run(input: AgentRunInput): AsyncIterable<AgentEvent> {
    const latest = input.messages.at(-1);
    const directFrom = findDirectSender(input.messages, input.agent.id);
    const prefix = directFrom ? `收到 ${directFrom} 的转交。` : "收到任务。";
    const latestSummary = latest
      ? `上一条消息来自 ${latest.senderId ?? latest.senderType}。`
      : "暂无上下文消息。";
    yield {
      type: "text",
      content: `${prefix}我是 ${input.agent.displayName}，已读取 ${input.messages.length} 条上下文。${latestSummary}`,
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
