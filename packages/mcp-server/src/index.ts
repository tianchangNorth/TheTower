#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type {
  PostAgentHandoffPayloadRequest,
  PostAgentMessageInput,
  PostAgentMessageResponse,
} from "@the-tower/shared";
import { registerFullToolset, type ToolsetEnv, listMcpToolDefs, type McpToolDef } from "./server-toolsets.js";

export { listMcpToolDefs, type McpToolDef };
export { postMessageInputSchema } from "./tools/callback-tools.js";

export interface CallbackClient {
  postMessage(input: PostAgentMessageInput): Promise<PostAgentMessageResponse>;
  getThreadContext(threadId: string, limit?: number): Promise<{
    messages: Array<CallbackMessage>;
  }>;
  readFile(input: { path: string }): Promise<{ path: string; content: string }>;
  readFileSlice(input: {
    path: string;
    startLine: number;
    endLine?: number;
  }): Promise<{ path: string; startLine: number; endLine: number; content: string }>;
  listFiles(input: { path?: string; recursive?: boolean }): Promise<{
    path: string;
    entries: string[];
    truncated: boolean;
  }>;
  writeFile(input: { path: string; content: string }): Promise<{ path: string; bytes: number }>;
}

export interface CallbackMessage {
  id: string;
  threadId: string;
  senderType: string;
  senderId?: string;
  content: string;
  mentions: string[];
  visibility?: string;
  visibleToAgentIds?: string[];
  origin?: string;
  deliveryStatus?: string;
  handoffPayload?: CallbackHandoffPayloadInput;
  invocationId?: string;
  replyTo?: string;
  createdAt: number;
}

export type CallbackHandoffPayloadInput = PostAgentHandoffPayloadRequest;

export interface AgentCallbackClientOptions {
  baseUrl: string;
  invocationId: string;
  callbackToken: string;
  fetch?: typeof fetch;
}

export class AgentCallbackHttpClient implements CallbackClient {
  private readonly baseUrl: string;
  private readonly invocationId: string;
  private readonly callbackToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AgentCallbackClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.invocationId = options.invocationId;
    this.callbackToken = options.callbackToken;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  postMessage(input: Parameters<CallbackClient["postMessage"]>[0]): ReturnType<CallbackClient["postMessage"]> {
    return this.request("/api/callbacks/post-message", {
      method: "POST",
      body: JSON.stringify({
        invocationId: this.invocationId,
        ...input,
      }),
    });
  }

  getThreadContext(threadId: string, limit?: number): ReturnType<CallbackClient["getThreadContext"]> {
    return this.request("/api/callbacks/thread-context", {
      method: "POST",
      body: JSON.stringify({ threadId, invocationId: this.invocationId, ...(limit !== undefined ? { limit } : {}) }),
    });
  }

  readFile(input: { path: string }): ReturnType<CallbackClient["readFile"]> {
    return this.request("/api/callbacks/tools/read-file", {
      method: "POST",
      body: JSON.stringify(this.withCallbackFields(input)),
    });
  }

  readFileSlice(input: {
    path: string;
    startLine: number;
    endLine?: number;
  }): ReturnType<CallbackClient["readFileSlice"]> {
    return this.request("/api/callbacks/tools/read-file-slice", {
      method: "POST",
      body: JSON.stringify(this.withCallbackFields(input)),
    });
  }

  listFiles(input: { path?: string; recursive?: boolean }): ReturnType<CallbackClient["listFiles"]> {
    return this.request("/api/callbacks/tools/list-files", {
      method: "POST",
      body: JSON.stringify(this.withCallbackFields(input)),
    });
  }

  writeFile(input: { path: string; content: string }): ReturnType<CallbackClient["writeFile"]> {
    return this.request("/api/callbacks/tools/write-file", {
      method: "POST",
      body: JSON.stringify(this.withCallbackFields(input)),
    });
  }

  private withCallbackFields(input: Record<string, unknown>): Record<string, unknown> {
    return {
      invocationId: this.invocationId,
      ...input,
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.callbackToken}`,
        "x-the-tower-carrier": "mcp",
        ...init?.headers,
      },
    });
    const text = await response.text();
    const body = text ? (JSON.parse(text) as unknown) : undefined;
    if (!response.ok) {
      const message =
        typeof body === "object" && body && "error" in body && typeof body.error === "string"
          ? body.error
          : `TheTower API request failed with status ${response.status}`;
      throw new Error(message);
    }
    return body as T;
  }
}

export interface TheTowerMcpServerOptions {
  callbackClient: CallbackClient;
  threadId: string;
  toolsetEnv?: ToolsetEnv;
}

export function createTheTowerMcpServer(options: TheTowerMcpServerOptions): McpServer {
  const server = new McpServer({
    name: "the-tower",
    version: "0.1.0",
  });
  registerFullToolset(
    server,
    {
      callbackClient: options.callbackClient,
      threadId: options.threadId,
    },
    options.toolsetEnv,
  );
  return server;
}

export async function main(): Promise<void> {
  const env = readCallbackEnv(process.env);
  const client = new AgentCallbackHttpClient({
    baseUrl: env.apiUrl,
    invocationId: env.invocationId,
    callbackToken: env.callbackToken,
  });
  const server = createTheTowerMcpServer({
    callbackClient: client,
    threadId: env.threadId,
  });
  await server.connect(new StdioServerTransport());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}

function readCallbackEnv(env: NodeJS.ProcessEnv): {
  apiUrl: string;
  threadId: string;
  invocationId: string;
  callbackToken: string;
} {
  const apiUrl = env.THE_TOWER_API_URL ?? "http://127.0.0.1:3001";
  const threadId = requireEnv(env, "THE_TOWER_THREAD_ID");
  const invocationId = requireEnv(env, "THE_TOWER_INVOCATION_ID");
  const callbackToken = requireEnv(env, "THE_TOWER_CALLBACK_TOKEN");
  return { apiUrl, threadId, invocationId, callbackToken };
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
