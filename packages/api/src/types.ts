export type AgentProvider = "codex" | "claude" | "gemini" | "openai-api" | "custom" | "mock";

export interface Agent {
  id: string;
  displayName: string;
  mentionHandles: string[];
  provider: AgentProvider;
  model: string;
  rolePrompt: string;
  enabled: boolean;
  createdAt: number;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export type SenderType = "user" | "agent" | "system";

export interface Message {
  id: string;
  threadId: string;
  senderType: SenderType;
  senderId?: string;
  content: string;
  mentions: string[];
  invocationId?: string;
  replyTo?: string;
  createdAt: number;
}

export type InvocationStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface Invocation {
  id: string;
  threadId: string;
  rootMessageId: string;
  status: InvocationStatus;
  targetAgents: string[];
  depth: number;
  createdAt: number;
  finishedAt?: number;
}

export interface CallbackToken {
  invocationId: string;
  tokenHash: string;
  expiresAt: number;
  active: boolean;
}

export interface WorklistEntry {
  invocationId: string;
  threadId: string;
  list: string[];
  currentIndex: number;
  depth: number;
  maxDepth: number;
  a2aFrom: Record<string, string>;
  triggerMessageId: Record<string, string>;
  abortController: AbortController;
  pingPong?: {
    from: string;
    to: string;
    count: number;
  };
}

export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "error"; error: string }
  | { type: "done" };

export interface AgentRunInput {
  agent: Agent;
  threadId: string;
  invocationId: string;
  messages: Message[];
  callbackToken: string;
  signal: AbortSignal;
}

export interface AgentRunner {
  run(input: AgentRunInput): AsyncIterable<AgentEvent>;
}
