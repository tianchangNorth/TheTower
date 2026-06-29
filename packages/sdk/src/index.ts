import type {
  AgentsResponse,
  HealthResponse,
  PostAgentMessageRequest,
  PostAgentMessageResponse,
  RevealMessageResponse,
  PostUserMessageRequest,
  PostUserMessageResponse,
  ThreadContextResponse,
  ThreadInvocationsResponse,
  ThreadMessagesResponse,
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
} from "@the-tower/shared";

export interface TheTowerClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export interface AgentCallbackOptions extends TheTowerClientOptions {
  invocationId: string;
  callbackToken: string;
  agentId: string;
}

export type AgentCallbackPostMessageInput = Omit<
  PostAgentMessageRequest,
  "invocationId" | "callbackToken" | "agentId"
>;

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

  updateAgent(agentId: string, input: UpdateAgentRequest): Promise<UpdateAgentResponse> {
    return this.request(`/api/agents/${encodeURIComponent(agentId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  listThreads(): Promise<ThreadsResponse> {
    return this.request("/api/threads");
  }

  listWorkspaces(): Promise<WorkspacesResponse> {
    return this.request("/api/workspaces");
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

  revealMessage(threadId: string, messageId: string): Promise<RevealMessageResponse> {
    return this.request(
      `/api/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}/reveal`,
      { method: "POST" },
    );
  }

  createAgentCallbackClient(input: {
    invocationId: string;
    callbackToken: string;
    agentId: string;
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
  private readonly agentId: string;

  constructor(options: AgentCallbackOptions) {
    this.client = new TheTowerClient({ baseUrl: options.baseUrl, fetch: options.fetch });
    this.invocationId = options.invocationId;
    this.callbackToken = options.callbackToken;
    this.agentId = options.agentId;
  }

  postMessage(input: AgentCallbackPostMessageInput): Promise<PostAgentMessageResponse> {
    const body: PostAgentMessageRequest = {
      invocationId: this.invocationId,
      callbackToken: this.callbackToken,
      agentId: this.agentId,
      ...input,
    };
    return this.client.request("/api/callbacks/post-message", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  getThreadContext(threadId: string, limit?: number): Promise<ThreadContextResponse> {
    const query = new URLSearchParams({
      threadId,
      invocationId: this.invocationId,
      callbackToken: this.callbackToken,
    });
    if (limit !== undefined) query.set("limit", String(limit));
    return this.client.request(`/api/callbacks/thread-context${formatQuery(query)}`);
  }
}

export class TheTowerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "TheTowerApiError";
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : undefined;
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body && typeof body.error === "string"
        ? body.error
        : `TheTower API request failed with status ${response.status}`;
    throw new TheTowerApiError(message, response.status, body);
  }
  return body as T;
}

function formatQuery(query: URLSearchParams): string {
  const value = query.toString();
  return value ? `?${value}` : "";
}
