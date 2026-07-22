import type {
  AgentsResponse,
  AgentRuntimeStatusResponse,
  HealthResponse,
  ListFilesInput,
  PostAgentMessageInput,
  PostAgentMessageResponse,
  ReadFileInput,
  ReadFileSliceInput,
  RevealMessageResponse,
  PostUserMessageRequest,
  PostUserMessageResponse,
  ThreadContextResponse,
  ThreadInvocationsResponse,
  CancelInvocationResponse,
  ThreadMessagesResponse,
  ThreadAgentContextResponse,
  SkillsCatalogResponse,
  SkillDetailResponse,
  McpToolsCatalogResponse,
  McpToolDetailResponse,
  InvocationInspectResponse,
  ThreadsResponse,
  WorkspacesResponse,
  CreateWorkspaceRequest,
  ValidateWorkspaceRequest,
  ValidateWorkspaceResponse,
  WorkspaceResponse,
  UpdateAgentRequest,
  UpdateAgentResponse,
  UpdateThreadRequest,
  UpdateThreadResponse,
  DeleteThreadResponse,
  AgentConfigResponse,
  AgentToolsResponse,
  AgentRuntimeConfigResponse,
  AgentAuditResponse,
  TelemetryThreadsResponse,
  InvocationsQueryResponse,
  TelemetryEventsResponse,
  ToolAuditQueryResponse,
  ThreadTelemetryContextResponse,
  InvocationStatus,
  WorkspaceActivityResponse,
  WorkspaceFilesResponse,
  WorkspaceSearchResponse,
  WorkspaceFileListResult,
  WorkspaceFileReadResult,
  WorkspaceFileSliceResult,
  WorkspaceFileWriteResult,
  WriteFileInput,
  CreateTaskRequest,
  UpdateTaskRequest,
  TasksResponse,
  TaskResponse,
  CreateTaskThreadRequest,
  CreateTaskThreadResponse,
  TaskThreadsResponse,
  CreateThreadRequest,
  CreateThreadResponse,
  DirListResponse,
  TowerErrorCode,
} from "@the-tower/shared";
import {
  towerErrorResponseSchema,
  threadContextResponseSchema,
  workspaceFileListResultSchema,
  workspaceFileReadResultSchema,
  workspaceFileSliceResultSchema,
  workspaceFileWriteResultSchema,
} from "@the-tower/shared";

export interface TelemetryQueryParams {
  threadId?: string;
  invocationId?: string;
  agentId?: string;
  status?: InvocationStatus;
  type?: string;
  from?: number;
  to?: number;
  limit?: number;
}

function buildQuery(params: TelemetryQueryParams): URLSearchParams {
  const q = new URLSearchParams();
  if (params.threadId) q.set("threadId", params.threadId);
  if (params.invocationId) q.set("invocationId", params.invocationId);
  if (params.agentId) q.set("agentId", params.agentId);
  if (params.status) q.set("status", params.status);
  if (params.type) q.set("type", params.type);
  if (params.from !== undefined) q.set("from", String(params.from));
  if (params.to !== undefined) q.set("to", String(params.to));
  if (params.limit !== undefined) q.set("limit", String(params.limit));
  return q;
}

export interface TheTowerClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export interface AgentCallbackOptions extends TheTowerClientOptions {
  invocationId: string;
  callbackToken: string;
  /** @deprecated Caller identity is derived from callbackToken. */
  agentId?: string;
}

export type AgentCallbackPostMessageInput = PostAgentMessageInput;

export class TheTowerClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TheTowerClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  health(): Promise<HealthResponse> {
    return this.request("/health");
  }

  listAgents(): Promise<AgentsResponse> {
    return this.request("/api/agents");
  }

  listAgentRuntimeStatuses(): Promise<AgentRuntimeStatusResponse> {
    return this.request("/api/agents/runtime-status");
  }

  updateAgent(agentId: string, input: UpdateAgentRequest): Promise<UpdateAgentResponse> {
    return this.request(`/api/agents/${encodeURIComponent(agentId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  getAgentConfig(agentId: string): Promise<AgentConfigResponse> {
    return this.request(`/api/agents/${encodeURIComponent(agentId)}/config`);
  }

  updateAgentConfig(agentId: string, input: UpdateAgentRequest): Promise<AgentConfigResponse> {
    return this.request(`/api/agents/${encodeURIComponent(agentId)}/config`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  getAgentTools(agentId: string): Promise<AgentToolsResponse> {
    return this.request(`/api/agents/${encodeURIComponent(agentId)}/tools`);
  }

  getAgentRuntime(agentId: string): Promise<AgentRuntimeConfigResponse> {
    return this.request(`/api/agents/${encodeURIComponent(agentId)}/runtime`);
  }

  getAgentAudit(agentId: string): Promise<AgentAuditResponse> {
    return this.request(`/api/agents/${encodeURIComponent(agentId)}/audit`);
  }

  getTelemetryThreads(): Promise<TelemetryThreadsResponse> {
    return this.request("/api/telemetry/threads");
  }

  queryInvocations(params: TelemetryQueryParams = {}): Promise<InvocationsQueryResponse> {
    return this.request(`/api/invocations${formatQuery(buildQuery(params))}`);
  }

  queryTelemetryEvents(params: TelemetryQueryParams = {}): Promise<TelemetryEventsResponse> {
    return this.request(`/api/telemetry/events${formatQuery(buildQuery(params))}`);
  }

  queryToolAudit(params: TelemetryQueryParams = {}): Promise<ToolAuditQueryResponse> {
    return this.request(`/api/telemetry/tool-audit${formatQuery(buildQuery(params))}`);
  }

  getThreadTelemetryContext(threadId: string): Promise<ThreadTelemetryContextResponse> {
    return this.request(`/api/threads/${encodeURIComponent(threadId)}/context`);
  }

  listTasks(): Promise<TasksResponse> {
    return this.request("/api/tasks");
  }

  createTask(input: CreateTaskRequest): Promise<TaskResponse> {
    return this.request("/api/tasks", { method: "POST", body: JSON.stringify(input) });
  }

  getTask(taskId: string): Promise<TaskResponse> {
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}`);
  }

  updateTask(taskId: string, input: UpdateTaskRequest): Promise<TaskResponse> {
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  createTaskThread(
    taskId: string,
    input: CreateTaskThreadRequest,
  ): Promise<CreateTaskThreadResponse> {
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/create-thread`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getTaskThreads(taskId: string): Promise<TaskThreadsResponse> {
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/threads`);
  }

  createThread(input: CreateThreadRequest): Promise<CreateThreadResponse> {
    return this.request("/api/threads", { method: "POST", body: JSON.stringify(input) });
  }

  listDirs(path?: string): Promise<DirListResponse> {
    const query = new URLSearchParams();
    if (path) query.set("path", path);
    return this.request(`/api/dirs${formatQuery(query)}`);
  }

  listThreads(): Promise<ThreadsResponse> {
    return this.request("/api/threads");
  }

  listWorkspaces(): Promise<WorkspacesResponse> {
    return this.request("/api/workspaces");
  }

  getWorkspace(workspaceId: string): Promise<WorkspaceResponse> {
    return this.request(`/api/workspaces/${encodeURIComponent(workspaceId)}`);
  }

  getWorkspaceActivity(workspaceId: string): Promise<WorkspaceActivityResponse> {
    return this.request(`/api/workspaces/${encodeURIComponent(workspaceId)}/activity`);
  }

  getWorkspaceFiles(workspaceId: string, path?: string): Promise<WorkspaceFilesResponse> {
    const query = new URLSearchParams();
    if (path) query.set("path", path);
    return this.request(`/api/workspaces/${encodeURIComponent(workspaceId)}/files${formatQuery(query)}`);
  }

  searchWorkspace(workspaceId: string, q: string): Promise<WorkspaceSearchResponse> {
    const query = new URLSearchParams({ q });
    return this.request(`/api/workspaces/${encodeURIComponent(workspaceId)}/search${formatQuery(query)}`);
  }

  createWorkspace(input: CreateWorkspaceRequest): Promise<WorkspaceResponse> {
    return this.request("/api/workspaces", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  validateWorkspace(input: ValidateWorkspaceRequest): Promise<ValidateWorkspaceResponse> {
    return this.request("/api/workspaces/validate", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateThread(threadId: string, input: UpdateThreadRequest): Promise<UpdateThreadResponse> {
    return this.request(`/api/threads/${encodeURIComponent(threadId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  deleteThread(threadId: string): Promise<DeleteThreadResponse> {
    return this.request(`/api/threads/${encodeURIComponent(threadId)}`, { method: "DELETE" });
  }

  postUserMessage(input: PostUserMessageRequest): Promise<PostUserMessageResponse> {
    return this.request("/api/messages", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getThreadMessages(threadId: string, limit?: number): Promise<ThreadMessagesResponse> {
    const query = new URLSearchParams();
    if (limit !== undefined) query.set("limit", String(limit));
    return this.request(`/api/threads/${encodeURIComponent(threadId)}/messages${formatQuery(query)}`);
  }

  getThreadInvocations(threadId: string, limit?: number): Promise<ThreadInvocationsResponse> {
    const query = new URLSearchParams();
    if (limit !== undefined) query.set("limit", String(limit));
    return this.request(`/api/threads/${encodeURIComponent(threadId)}/invocations${formatQuery(query)}`);
  }

  cancelInvocation(threadId: string, invocationId: string): Promise<CancelInvocationResponse> {
    return this.request(
      `/api/threads/${encodeURIComponent(threadId)}/invocations/${encodeURIComponent(invocationId)}/cancel`,
      { method: "POST" },
    );
  }

  getThreadAgentStatuses(threadId: string): Promise<AgentRuntimeStatusResponse> {
    return this.request(`/api/threads/${encodeURIComponent(threadId)}/agent-status`);
  }

  getThreadAgentContext(
    threadId: string,
    agentId: string,
    limit?: number,
  ): Promise<{ context: ThreadAgentContextResponse }> {
    const query = new URLSearchParams({ agentId });
    if (limit !== undefined) query.set("limit", String(limit));
    return this.request(
      `/api/threads/${encodeURIComponent(threadId)}/agent-context${formatQuery(query)}`,
    );
  }

  listSkills(): Promise<SkillsCatalogResponse> {
    return this.request("/api/skills");
  }

  getSkill(skillId: string): Promise<SkillDetailResponse> {
    return this.request(`/api/skills/${encodeURIComponent(skillId)}`);
  }

  listMcpTools(): Promise<McpToolsCatalogResponse> {
    return this.request("/api/mcp-tools");
  }

  getMcpTool(toolName: string): Promise<McpToolDetailResponse> {
    return this.request(`/api/mcp-tools/${encodeURIComponent(toolName)}`);
  }

  getInvocationInspect(invocationId: string): Promise<InvocationInspectResponse> {
    return this.request(`/api/invocations/${encodeURIComponent(invocationId)}/inspect`);
  }

  revealMessage(threadId: string, messageId: string): Promise<RevealMessageResponse> {
    return this.request(
      `/api/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}/reveal`,
      { method: "POST" },
    );
  }

  createAgentCallbackClient(input: {
    invocationId: string;
    callbackToken: string;
    agentId?: string;
  }): AgentCallbackClient {
    return new AgentCallbackClient({
      baseUrl: this.baseUrl,
      fetch: this.fetchImpl,
      ...input,
    });
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body !== undefined && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    return parseJsonResponse<T>(response);
  }
}

export class AgentCallbackClient {
  private readonly client: TheTowerClient;
  private readonly invocationId: string;
  private readonly callbackToken: string;

  constructor(options: AgentCallbackOptions) {
    this.client = new TheTowerClient({ baseUrl: options.baseUrl, fetch: options.fetch });
    this.invocationId = options.invocationId;
    this.callbackToken = options.callbackToken;
  }

  postMessage(input: AgentCallbackPostMessageInput): Promise<PostAgentMessageResponse> {
    const body = {
      invocationId: this.invocationId,
      ...input,
    };
    return this.client.request("/api/callbacks/post-message", {
      method: "POST",
      headers: { authorization: `Bearer ${this.callbackToken}`, "x-the-tower-carrier": "sdk" },
      body: JSON.stringify(body),
    });
  }

  getThreadContext(threadId: string, limit?: number): Promise<ThreadContextResponse> {
    return this.client.request<unknown>("/api/callbacks/thread-context", {
      method: "POST",
      headers: { authorization: `Bearer ${this.callbackToken}`, "x-the-tower-carrier": "sdk" },
      body: JSON.stringify({ threadId, invocationId: this.invocationId, ...(limit !== undefined ? { limit } : {}) }),
    }).then((result) => threadContextResponseSchema.parse(result));
  }

  readFile(input: ReadFileInput): Promise<WorkspaceFileReadResult> {
    return this.callbackFileRequest("read-file", input, workspaceFileReadResultSchema.parse);
  }

  readFileSlice(input: ReadFileSliceInput): Promise<WorkspaceFileSliceResult> {
    return this.callbackFileRequest("read-file-slice", input, workspaceFileSliceResultSchema.parse);
  }

  listFiles(input: ListFilesInput = {}): Promise<WorkspaceFileListResult> {
    return this.callbackFileRequest("list-files", input, workspaceFileListResultSchema.parse);
  }

  writeFile(input: WriteFileInput): Promise<WorkspaceFileWriteResult> {
    return this.callbackFileRequest("write-file", input, workspaceFileWriteResultSchema.parse);
  }

  private callbackFileRequest<T>(
    endpoint: "read-file" | "read-file-slice" | "list-files" | "write-file",
    input: object,
    parse: (value: unknown) => T,
  ): Promise<T> {
    return this.client.request<unknown>(`/api/callbacks/tools/${endpoint}`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.callbackToken}`, "x-the-tower-carrier": "sdk" },
      body: JSON.stringify({ invocationId: this.invocationId, ...input }),
    }).then(parse);
  }
}

export class TheTowerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
    readonly code?: TowerErrorCode,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TheTowerApiError";
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // Non-JSON body (e.g. plain-text "Internal Server Error" from the dev
      // proxy when the API upstream is unreachable). Leave body undefined and
      // fall through to the !response.ok path so callers get a TheTowerApiError
      // instead of a SyntaxError escaping this function unhandled.
      body = undefined;
    }
  }
  if (!response.ok) {
    const parsedError = towerErrorResponseSchema.safeParse(body);
    const message =
      parsedError.success
        ? parsedError.data.error
        : typeof body === "object" && body && "error" in body && typeof body.error === "string"
          ? body.error
          : text
            ? text.trim().slice(0, 200)
            : `TheTower API request failed with status ${response.status}`;
    throw new TheTowerApiError(
      message,
      response.status,
      body ?? text,
      parsedError.success ? parsedError.data.code : undefined,
      parsedError.success ? parsedError.data.details : undefined,
    );
  }
  return body as T;
}

function formatQuery(query: URLSearchParams): string {
  const value = query.toString();
  return value ? `?${value}` : "";
}
