import type { AgentEvent, AgentRunInput, AgentRunner } from "../../types.js";

export class MockRunner implements AgentRunner {
  private readonly delayMs = parseDelay(process.env.THE_TOWER_MOCK_RUNNER_DELAY_MS);

  async *run(input: AgentRunInput): AsyncIterable<AgentEvent> {
    if (!(await waitForDelay(this.delayMs, input.signal))) return;

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
      mode: "block",
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
        contextUsedTokens: 100 + input.messages.length * 25,
        budgetTokens: 128_000,
        source: "provider",
      },
    };
    yield { type: "done" };
  }
}

function parseDelay(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function waitForDelay(delayMs: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  if (delayMs === 0) return Promise.resolve(true);

  return new Promise((resolve) => {
    const finish = (completed: boolean) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(completed);
    };
    const onAbort = () => finish(false);
    const timer = setTimeout(() => finish(true), delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
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
