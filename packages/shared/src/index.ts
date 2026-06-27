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

export type ThreadMode = "debug" | "play";
export type A2ARouteMode = "single" | "serial" | "fanout" | "parallel";

export interface Thread {
  id: string;
  title: string;
  mode?: ThreadMode;
  createdAt: number;
  updatedAt: number;
}

export type SenderType = "user" | "agent" | "system";

export type MessageVisibility = "public" | "private";

export type MessageOrigin =
  | "user"
  | "agent_final"
  | "agent_stream"
  | "callback"
  | "tool"
  | "system"
  | "briefing";

export type MessageDeliveryStatus = "queued" | "delivered" | "canceled";

export interface HandoffPayload {
  fromAgentId: string;
  toAgentIds: string[];
  triggerMessageId?: string;
  what: string;
  why: string;
  tradeoff: string;
  openQuestions: string[];
  nextAction: string;
  evidenceRefs?: Array<{
    kind: "message" | "file" | "command" | "url" | "other";
    ref: string;
    note?: string;
  }>;
  riskLevel?: "low" | "medium" | "high";
  createdAt: number;
}

export type PostAgentHandoffPayloadRequest = Omit<
  HandoffPayload,
  "fromAgentId" | "openQuestions" | "createdAt"
> &
  Partial<Pick<HandoffPayload, "fromAgentId" | "openQuestions" | "createdAt">>;

export interface Message {
  id: string;
  threadId: string;
  senderType: SenderType;
  senderId?: string;
  content: string;
  mentions: string[];
  visibility?: MessageVisibility;
  visibleToAgentIds?: string[];
  revealedAt?: number;
  origin?: MessageOrigin;
  deliveryStatus?: MessageDeliveryStatus;
  handoffPayload?: HandoffPayload;
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
  routeMode?: A2ARouteMode;
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
  routeMode: A2ARouteMode;
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

export interface ResolvedSkill {
  id: string;
  name: string;
  priority: number;
  prompt: string;
}

export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "error"; error: string }
  | { type: "done" };

export interface AgentRunInput {
  agent: Agent;
  availableAgents: Agent[];
  worklistAgents?: string[];
  worklistIndex?: number;
  routeMode?: A2ARouteMode;
  remainingAgents?: string[];
  directMessageFrom?: string;
  a2aEnabled?: boolean;
  threadId: string;
  invocationId: string;
  messages: Message[];
  activeSkills?: ResolvedSkill[];
  callbackToken: string;
  signal: AbortSignal;
}

export interface AgentRunner {
  run(input: AgentRunInput): AsyncIterable<AgentEvent>;
}

export interface HealthResponse {
  ok: boolean;
}

export interface AgentsResponse {
  agents: Agent[];
}

export type UpdateAgentRequest = Partial<
  Pick<Agent, "displayName" | "mentionHandles" | "provider" | "model" | "rolePrompt" | "enabled">
>;

export interface UpdateAgentResponse {
  agent: Agent;
}

export interface ThreadsResponse {
  threads: Thread[];
}

export interface UpdateThreadRequest {
  mode: ThreadMode;
}

export interface UpdateThreadResponse {
  thread: Thread;
}

export interface ThreadMessagesResponse {
  messages: Message[];
}

export interface ThreadInvocationsResponse {
  invocations: Invocation[];
}

export interface RevealMessageResponse {
  message: Message;
}

export interface PostUserMessageRequest {
  threadId?: string;
  content: string;
  targetAgents?: string[];
  routeMode?: A2ARouteMode;
}

export interface PostUserMessageResponse {
  threadId: string;
  messageId: string;
  invocationId: string;
  targetAgents: string[];
}

export interface PostAgentMessageRequest {
  invocationId: string;
  callbackToken: string;
  agentId: string;
  content: string;
  targetAgents?: string[];
  routeMode?: A2ARouteMode;
  visibility?: MessageVisibility;
  visibleToAgentIds?: string[];
  handoffPayload?: PostAgentHandoffPayloadRequest;
  replyTo?: string;
}

export interface PostAgentMessageResponse {
  messageId: string;
  routed: string[];
}

export interface ThreadContextRequest {
  threadId: string;
  invocationId?: string;
  callbackToken?: string;
  limit?: number;
}

export interface ThreadContextResponse {
  messages: Message[];
}
