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
    const mode = input.mode ?? "play";
    const messages = this.deps.messageStore
      .listByThread(input.threadId, input.limit ?? 100)
      .filter((message) => canIncludeMessage({ message, agentId: input.agentId, mode }))
      .map((message) => redactPrivateThinking(message, input.agentId));

    return {
      threadId: input.threadId,
      agentId: input.agentId,
      mode,
      messages,
    };
  }
}

function redactPrivateThinking(message: Message, viewerAgentId: string): Message {
  if (
    message.origin !== "agent_stream" ||
    message.senderType !== "agent" ||
    message.senderId === viewerAgentId ||
    !message.thinking
  ) {
    return message;
  }
  return { ...message, thinking: undefined };
}

function canIncludeMessage(input: { message: Message; agentId: string; mode: ThreadMode }): boolean {
  return canIncludeInAgentContext({
    message: input.message,
    viewer: { type: "agent", agentId: input.agentId },
    mode: input.mode,
  });
}
