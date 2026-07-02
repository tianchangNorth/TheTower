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
    chunkType?: "thinking" | "text" | "tool_call" | "error";
    toolName?: string;
    cliStdout?: string;
    speechContent?: string;
    chunks?: Array<{
      chunkType: "thinking" | "text" | "tool_call" | "error";
      content: string;
      toolName?: string;
      createdAt: number;
    }>;
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

export type AgentWorkStatus =
  | "idle"
  | "thinking"
  | "tool_calling"
  | "replying"
  | "alive_but_silent"
  | "suspected_stall"
  | "done"
  | "error";

export interface AgentTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  costEstimated?: boolean;
  durationMs?: number;
  durationApiMs?: number;
  numTurns?: number;
  contextWindowSize?: number;
  lastTurnInputTokens?: number;
  isCumulativeUsage?: boolean;
  contextUsedTokens?: number;
  contextResetsAtMs?: number;
  budgetTokens?: number;
  remainingTokens?: number;
  source: "provider" | "estimated" | "unavailable";
}

export interface AgentLivenessSnapshot {
  state: "active" | "busy_silent" | "idle_silent" | "dead";
  silenceDurationMs: number;
  processAlive?: boolean;
  lastEventType?: string;
  checkedAt: number;
}

export interface AgentRuntimeStatus {
  agentId: string;
  threadId?: string;
  invocationId?: string;
  status: AgentWorkStatus;
  detail?: string;
  currentToolName?: string;
  startedAt?: number;
  lastEventAt?: number;
  lastToolAt?: number;
  lastTextAt?: number;
  updatedAt: number;
  tokenUsage?: AgentTokenUsage;
  liveness?: AgentLivenessSnapshot;
}

export interface AgentRuntimeStatusResponse {
  statuses: AgentRuntimeStatus[];
}

export type AgentEvent =
  | { type: "thinking"; content?: string }
  | { type: "stream_text"; content: string }
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "token_usage"; usage: AgentTokenUsage }
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

/** GET /api/agents/:id/config —— 当前等同于 Agent 的可编辑切片（identity/persona/model/enabled）。 */
export interface AgentConfigResponse {
  agent: Agent;
}

/** GET /api/agents/:id/tools —— 工具权限配置。第一版占位：后端尚未建模 agent 工具权限。 */
export interface AgentToolsResponse {
  enabledTools: string[];
  mcpServers: string[];
  note?: string;
}

/** GET /api/agents/:id/runtime —— 运行策略。第一版占位：字段为 null 表示未配置。 */
export interface AgentRuntimeConfigResponse {
  sandbox: string | null;
  approval: string | null;
  timeoutMs: number | null;
  tokenBudget: number | null;
  concurrency: number | null;
  note?: string;
}

export interface AgentAuditEntry {
  at: number;
  kind: "error" | "config_change" | "tool_denied";
  message: string;
}

/** GET /api/agents/:id/audit —— 最近错误与配置变更。第一版占位：空数组。 */
export interface AgentAuditResponse {
  recentErrors: AgentAuditEntry[];
  configChanges: AgentAuditEntry[];
  note?: string;
}

// ============ Telemetry（Phase 4）============

/** 服务端事件 union（SSE 与 Telemetry 查询共用）。 */
export type ServerEvent =
  | { type: "message.created"; threadId: string; messageId: string }
  | { type: "message.updated"; threadId: string; messageId: string }
  | { type: "invocation.updated"; threadId: string; invocationId: string; status: string }
  | {
      type: "agent.status" | "agent.token_usage" | "agent.liveness";
      threadId: string;
      invocationId: string;
      agentId: string;
      status: AgentRuntimeStatus;
      createdAt: number;
    }
  | {
      type: "workspace.resolved";
      threadId: string;
      invocationId: string;
      projectPath?: string;
      workingDirectory?: string;
      workspaceFingerprint?: string;
    }
  | {
      type: "workspace.file_tool";
      threadId: string;
      invocationId: string;
      agentId: string;
      tool: "read_file" | "read_file_slice" | "list_files" | "write_file";
      path: string;
      bytes?: number;
      denied: boolean;
      reason?: string;
      createdAt: number;
    }
  | { type: "worklist.updated"; threadId: string; invocationId: string; agents: string[] }
  | {
      type: "agent.event";
      threadId: string;
      invocationId: string;
      agentId: string;
      eventType: "text" | "tool_call" | "error" | "done";
      name?: string;
      error?: string;
    }
  | {
      type: "callback.write";
      threadId: string;
      invocationId: string;
      agentId: string;
      messageId: string;
      visibility: "public" | "private";
      routed: string[];
    };

/** 带序号的事件条目，供 Telemetry 查询与未来 SSE catch-up。 */
export interface TelemetryEventEntry {
  seq: number;
  event: ServerEvent;
}

export interface TelemetryThreadSummary {
  thread: Thread;
  workspaceLabel?: string;
  projectPath?: string;
  activeAgentIds: string[];
  latestInvocation?: Invocation;
  messageCount: number;
  errorCount: number;
  lastEventAt?: number;
}

export interface TelemetryThreadsResponse {
  threads: TelemetryThreadSummary[];
}

export interface InvocationsQueryResponse {
  invocations: Invocation[];
}

export interface TelemetryEventsResponse {
  events: TelemetryEventEntry[];
  /** live_only = 进程内 ring buffer，重启清空；persistent = 已落盘（后续 phase）。 */
  capability: "live_only" | "persistent";
  note?: string;
}

export interface ToolAuditRow {
  seq: number;
  threadId: string;
  invocationId: string;
  agentId: string;
  tool: string;
  path: string;
  bytes?: number;
  denied: boolean;
  reason?: string;
  createdAt?: number;
}

export interface ToolAuditQueryResponse {
  rows: ToolAuditRow[];
  capability: "live_only" | "persistent";
  note?: string;
}

export interface TelemetryContextRecentMessage {
  id: string;
  senderType: SenderType;
  senderId?: string;
  visibility?: MessageVisibility;
  origin?: MessageOrigin;
  revealedAt?: number;
  hasHandoff: boolean;
  createdAt: number;
  summary: string;
}

export interface ThreadTelemetryContextResponse {
  thread: Thread;
  workspaceLabel?: string;
  projectPath?: string;
  workspaceFingerprint?: string | null;
  messageCounts: {
    total: number;
    public: number;
    private: number;
    revealed: number;
    handoff: number;
  };
  recentMessages: TelemetryContextRecentMessage[];
  latestInvocation?: Invocation;
  activeAgentIds: string[];
  privateVisibility: Array<{ agentId: string; privateCount: number }>;
  recentFileToolAccess: ToolAuditRow[];
  staleReason?: string;
  estimatedTokens?: number | null;
  note?: string;
}

export interface ThreadsResponse {
  threads: Thread[];
}

// ============ Workspace（Phase 5）============

export interface WorkspaceActivityResponse {
  workspace: Workspace;
  threads: TelemetryThreadSummary[];
  activity: ToolAuditRow[];
  capability: "live_only" | "persistent";
  note?: string;
}

export interface WorkspaceFileEntry {
  name: string;
  kind: "file" | "dir";
  size?: number;
}

export interface WorkspaceFilesResponse {
  entries: WorkspaceFileEntry[];
  capability: "unavailable" | "persistent";
  note?: string;
}

export interface WorkspaceSearchMatch {
  path: string;
  line?: number;
  preview?: string;
}

export interface WorkspaceSearchResponse {
  matches: WorkspaceSearchMatch[];
  capability: "unavailable" | "persistent";
  note?: string;
}

// ============ Tasks / Mission（Phase 6）============

export type TaskStatus = "todo" | "in_progress" | "done" | "blocked" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  summary?: string;
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  ownerAgentId?: string;
  projectPath?: string;
  threadIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CreateTaskRequest {
  title: string;
  summary?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  tags?: string[];
  ownerAgentId?: string;
  projectPath?: string;
}

export type UpdateTaskRequest = Partial<CreateTaskRequest>;

export interface TasksResponse {
  tasks: Task[];
}

export interface TaskResponse {
  task: Task;
}

export interface CreateTaskThreadRequest {
  content?: string;
  mode?: ThreadMode;
}

export interface CreateTaskThreadResponse {
  task: Task;
  thread: Thread;
}

export interface TaskThreadsResponse {
  threads: Thread[];
}

// ============ 新建 Thread + 目录浏览（Phase 6+）============

export interface CreateThreadRequest {
  title: string;
  projectPath?: string;
  mode?: ThreadMode;
}

export interface CreateThreadResponse {
  thread: Thread;
}

export interface DirEntry {
  name: string;
  path: string;
}

export interface DirListResponse {
  path: string;
  parent?: string;
  entries: DirEntry[];
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

export interface ThreadAgentContextResponse {
  threadId: string;
  agentId: string;
  mode: ThreadMode;
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
