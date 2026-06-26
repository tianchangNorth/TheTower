import type { Message, ThreadMode } from "@the-tower/shared";
import { canIncludeInAgentContext } from "./VisibilityPolicy.js";

export interface BuildAgentContextInput {
  threadId: string;
  agentId: string;
  mode?: ThreadMode;
  limit?: number;
}

export interface AgentContext {
  threadId: string;
  agentId: string;
  mode: ThreadMode;
  messages: Message[];
}

export class ContextBuilder {
  constructor(private readonly deps: { messageStore: { listByThread(threadId: string, limit?: number): Message[] } }) {}

  buildForAgent(input: BuildAgentContextInput): AgentContext {
    const mode = input.mode ?? "debug";
    const messages = this.deps.messageStore
      .listByThread(input.threadId, input.limit ?? 100)
      .filter((message) => canIncludeMessage({ message, agentId: input.agentId, mode }));

    return {
      threadId: input.threadId,
      agentId: input.agentId,
      mode,
      messages,
    };
  }
}

function canIncludeMessage(input: { message: Message; agentId: string; mode: ThreadMode }): boolean {
  if (input.mode === "play") {
    return canIncludeInAgentContext({
      message: input.message,
      viewer: { type: "agent", agentId: input.agentId },
      mode: input.mode,
    });
  }

  return canIncludeInDebugContext(input.message);
}

function canIncludeInDebugContext(message: Message): boolean {
  if (message.deliveryStatus && message.deliveryStatus !== "delivered") return false;
  if (message.origin === "briefing") return false;
  return true;
}
