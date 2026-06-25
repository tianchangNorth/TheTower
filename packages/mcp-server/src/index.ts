#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

export interface CallbackClient {
  postMessage(input: { content: string; targetAgents?: string[]; replyTo?: string }): Promise<{
    messageId: string;
    routed: string[];
  }>;
  getThreadContext(threadId: string, limit?: number): Promise<{
    messages: Array<{
      id: string;
      threadId: string;
      senderType: string;
      senderId?: string;
      content: string;
      mentions: string[];
      invocationId?: string;
      replyTo?: string;
      createdAt: number;
    }>;
  }>;
}

export interface AgentCallbackClientOptions {
  baseUrl: string;
  invocationId: string;
  callbackToken: string;
  agentId: string;
  fetch?: typeof fetch;
}

export class AgentCallbackHttpClient implements CallbackClient {
  private readonly baseUrl: string;
  private readonly invocationId: string;
  private readonly callbackToken: string;
  private readonly agentId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AgentCallbackClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.invocationId = options.invocationId;
    this.callbackToken = options.callbackToken;
    this.agentId = options.agentId;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  postMessage(input: { content: string; targetAgents?: string[]; replyTo?: string }): Promise<{
    messageId: string;
    routed: string[];
  }> {
    return this.request("/api/callbacks/post-message", {
      method: "POST",
      body: JSON.stringify({
        invocationId: this.invocationId,
        callbackToken: this.callbackToken,
        agentId: this.agentId,
        ...input,
      }),
    });
  }

  getThreadContext(threadId: string, limit?: number): Promise<{
    messages: Array<{
      id: string;
      threadId: string;
      senderType: string;
      senderId?: string;
      content: string;
      mentions: string[];
      invocationId?: string;
      replyTo?: string;
      createdAt: number;
    }>;
  }> {
    const query = new URLSearchParams({
      threadId,
      invocationId: this.invocationId,
      callbackToken: this.callbackToken,
    });
    if (limit !== undefined) query.set("limit", String(limit));
    return this.request(`/api/callbacks/thread-context?${query.toString()}`);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
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
}

export function createTheTowerMcpServer(options: TheTowerMcpServerOptions): McpServer {
  const server = new McpServer({
    name: "the-tower",
    version: "0.1.0",
  });

  server.registerTool(
    "post_message",
    {
      title: "Post message",
      description:
        "Post a visible agent message to the current TheTower thread. Use this when you need to speak or hand off to another agent during execution.",
      inputSchema: {
        content: z.string().min(1),
        targetAgents: z.array(z.string().min(1)).optional(),
        replyTo: z.string().min(1).optional(),
      },
    },
    async ({ content, targetAgents, replyTo }) => {
      const result = await options.callbackClient.postMessage({ content, targetAgents, replyTo });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_thread_context",
    {
      title: "Get thread context",
      description: "Read recent visible messages from the current TheTower thread.",
      inputSchema: {
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async ({ limit }) => {
      const result = await options.callbackClient.getThreadContext(options.threadId, limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    },
  );

  return server;
}

export async function main(): Promise<void> {
  const env = readCallbackEnv(process.env);
  const client = new AgentCallbackHttpClient({
    baseUrl: env.apiUrl,
    invocationId: env.invocationId,
    callbackToken: env.callbackToken,
    agentId: env.agentId,
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
  agentId: string;
  threadId: string;
  invocationId: string;
  callbackToken: string;
} {
  const apiUrl = env.THE_TOWER_API_URL ?? "http://127.0.0.1:3001";
  const agentId = requireEnv(env, "THE_TOWER_AGENT_ID");
  const threadId = requireEnv(env, "THE_TOWER_THREAD_ID");
  const invocationId = requireEnv(env, "THE_TOWER_INVOCATION_ID");
  const callbackToken = requireEnv(env, "THE_TOWER_CALLBACK_TOKEN");
  return { apiUrl, agentId, threadId, invocationId, callbackToken };
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
