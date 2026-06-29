export type AgentProvider = "codex" | "claude" | "gemini" | "openai-api" | "custom" | "mock";

/**
 * 结构化人格配置（取代旧的单段 rolePrompt）。
 * 参照 clowder-ai 的 cat-template：人格是数据 + 极短身份模板 + 身份契约（签名），
 * 而不是大段提示词。所有字段在 system prompt 中拼成 ~150-200 tokens 的身份锚点。
 */
export interface AgentPersona {
  /** 一句话角色定位（必填） */
  roleDescription: string;
  /** 一句话性格（必填） */
  personality: string;
  /** 擅长领域 */
  strengths: string[];
  /** 硬限制/边界：被 @ 做这类任务时 push back 或退回给 @ 你的 Agent */
  restrictions: string[];
  /** 背景叙事 1-2 句（可选） */
  background?: string;
  /** 语气约束（文本人格，非 TTS） */
  voice?: { instruct?: string; tone?: string };
  /** 口癖/习惯动作（可选） */
  quirks?: string[];
  /** 签名标记；缺省由 displayName+model 生成，如 `[Zavala/glm🐾]` */
  signature?: string;
}

export interface Agent {
  id: string;
  displayName: string;
  mentionHandles: string[];
  provider: AgentProvider;
  model: string;
  persona: AgentPersona;
  enabled: boolean;
  createdAt: number;
}

export type ThreadMode = "debug" | "play";
export type A2ARouteMode = "single" | "serial" | "fanout" | "parallel";

export interface Thread {
  id: string;
  title: string;
  mode?: ThreadMode;
  projectPath?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Workspace {
  id: string;
  name: string;
  projectPath: string;
  trustedAt: number;
  lastOpenedAt: number;
  createdAt: number;
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

export interface MessageExtra {
  isExplicitPost?: boolean;
  stream?: {
    invocationId?: string;
    cliStdout?: string;
    speechContent?: string;
  };
}

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
  extra?: MessageExtra;
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
  triggerOrigin: Record<string, MessageOrigin>;
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
  projectPath?: string;
  workingDirectory?: string;
  workspaceFingerprint?: string;
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
  Pick<Agent, "displayName" | "mentionHandles" | "provider" | "model" | "persona" | "enabled">
>;

export interface UpdateAgentResponse {
  agent: Agent;
}

export interface ThreadsResponse {
  threads: Thread[];
}

export interface UpdateThreadRequest {
  mode?: ThreadMode;
  projectPath?: string | null;
}

export interface UpdateThreadResponse {
  thread: Thread;
}

export interface DeleteThreadResponse {
  threadId: string;
}

export interface ThreadMessagesResponse {
  messages: Message[];
}

export interface ThreadInvocationsResponse {
  invocations: Invocation[];
}

export interface WorkspacesResponse {
  workspaces: Workspace[];
}

export interface CreateWorkspaceRequest {
  projectPath: string;
  name?: string;
}

export interface WorkspaceResponse {
  workspace: Workspace;
}

export interface ValidateWorkspaceRequest {
  projectPath: string;
}

export type ValidateWorkspaceResponse =
  | { ok: true; projectPath: string; name: string }
  | { ok: false; reason: string; error: string };

export interface RevealMessageResponse {
  message: Message;
}

export interface PostUserMessageRequest {
  threadId?: string;
  content: string;
  projectPath?: string;
  workspaceId?: string;
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
