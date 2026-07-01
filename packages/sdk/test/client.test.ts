import assert from "node:assert/strict";
import test from "node:test";
import { AgentCallbackClient, TheTowerApiError, TheTowerClient } from "../src/index.js";

test("TheTowerClient posts user messages to the message API", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new TheTowerClient({
    baseUrl: "http://localhost:3001/",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        threadId: "thread-1",
        messageId: "message-1",
        invocationId: "invocation-1",
        targetAgents: ["agent-a"],
      });
    },
  });

  const result = await client.postUserMessage({ content: "@agent-a hello" });

  assert.deepEqual(result.targetAgents, ["agent-a"]);
  assert.equal(calls[0]?.url, "http://localhost:3001/api/messages");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.body, JSON.stringify({ content: "@agent-a hello" }));
});

test("TheTowerClient posts structured fanout user messages", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new TheTowerClient({
    baseUrl: "http://localhost:3001/",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        threadId: "thread-1",
        messageId: "message-1",
        invocationId: "invocation-1",
        targetAgents: ["agent-a", "agent-b"],
      });
    },
  });

  await client.postUserMessage({
    content: "请分别自我介绍。",
    targetAgents: ["agent-a", "agent-b"],
    routeMode: "fanout",
  });

  assert.equal(
    calls[0]?.init?.body,
    JSON.stringify({
      content: "请分别自我介绍。",
      targetAgents: ["agent-a", "agent-b"],
      routeMode: "fanout",
    }),
  );
});

test("TheTowerClient patches agent configuration", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new TheTowerClient({
    baseUrl: "http://localhost:3001/",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        agent: {
          id: "agent-a",
          displayName: "Agent A",
          mentionHandles: ["@agent-a"],
          provider: "codex",
          model: "gpt-5",
          persona: { roleDescription: "测试角色", personality: "测试性格", strengths: [], restrictions: [] },
          enabled: true,
          createdAt: 1,
        },
      });
    },
  });

  const result = await client.updateAgent("agent-a", { provider: "codex", model: "gpt-5" });

  assert.equal(result.agent.provider, "codex");
  assert.equal(calls[0]?.url, "http://localhost:3001/api/agents/agent-a");
  assert.equal(calls[0]?.init?.method, "PATCH");
  assert.equal(calls[0]?.init?.body, JSON.stringify({ provider: "codex", model: "gpt-5" }));
});

test("TheTowerClient reads agent config", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new TheTowerClient({
    baseUrl: "http://localhost:3001/",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        agent: {
          id: "agent-a",
          displayName: "Agent A",
          mentionHandles: ["@agent-a"],
          provider: "claude",
          model: "glm-5.2",
          persona: { roleDescription: "r", personality: "p", strengths: [], restrictions: [] },
          enabled: true,
          createdAt: 1,
        },
      });
    },
  });

  const result = await client.getAgentConfig("agent-a");

  assert.equal(result.agent.id, "agent-a");
  assert.equal(calls[0]?.url, "http://localhost:3001/api/agents/agent-a/config");
  assert.equal(calls[0]?.init?.method, undefined);
});

test("TheTowerClient patches agent config and surfaces errors", async () => {
  const client = new TheTowerClient({
    baseUrl: "http://localhost:3001/",
    fetch: async () => jsonResponse({ error: "agent tools config not yet implemented" }, 501),
  });

  await assert.rejects(() => client.updateAgentConfig("agent-a", { enabled: false }), {
    name: "TheTowerApiError",
    status: 501,
  });
});

test("TheTowerClient reads agent tools/runtime/audit placeholders", async () => {
  const urls: string[] = [];
  const client = new TheTowerClient({
    baseUrl: "http://localhost:3001/",
    fetch: async (url) => {
      urls.push(String(url));
      if (url.toString().includes("/tools")) {
        return jsonResponse({ enabledTools: [], mcpServers: [], note: "tools placeholder" });
      }
      if (url.toString().includes("/runtime")) {
        return jsonResponse({
          sandbox: null,
          approval: null,
          timeoutMs: null,
          tokenBudget: null,
          concurrency: null,
          note: "runtime placeholder",
        });
      }
      return jsonResponse({ recentErrors: [], configChanges: [], note: "audit placeholder" });
    },
  });

  const tools = await client.getAgentTools("agent-a");
  const runtime = await client.getAgentRuntime("agent-a");
  const audit = await client.getAgentAudit("agent-a");

  assert.equal(tools.enabledTools.length, 0);
  assert.equal(runtime.sandbox, null);
  assert.equal(audit.configChanges.length, 0);
  assert.deepEqual(
    urls,
    [
      "http://localhost:3001/api/agents/agent-a/tools",
      "http://localhost:3001/api/agents/agent-a/runtime",
      "http://localhost:3001/api/agents/agent-a/audit",
    ],
  );
});

test("TheTowerClient patches thread mode", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new TheTowerClient({
    baseUrl: "http://localhost:3001/",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        thread: {
          id: "thread-1",
          title: "Thread",
          mode: "play",
          createdAt: 1,
          updatedAt: 2,
        },
      });
    },
  });

  const result = await client.updateThread("thread-1", { mode: "play" });

  assert.equal(result.thread.mode, "play");
  assert.equal(calls[0]?.url, "http://localhost:3001/api/threads/thread-1");
  assert.equal(calls[0]?.init?.method, "PATCH");
  assert.equal(calls[0]?.init?.body, JSON.stringify({ mode: "play" }));
});

test("TheTowerClient reveals a private message", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new TheTowerClient({
    baseUrl: "http://localhost:3001/",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        message: {
          id: "message-1",
          threadId: "thread-1",
          senderType: "agent",
          content: "private",
          mentions: [],
          visibility: "private",
          revealedAt: 123,
          createdAt: 1,
        },
      });
    },
  });

  const result = await client.revealMessage("thread/1", "message 1");

  assert.equal(result.message.revealedAt, 123);
  assert.equal(calls[0]?.url, "http://localhost:3001/api/threads/thread%2F1/messages/message%201/reveal");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(new Headers(calls[0]?.init?.headers).has("content-type"), false);
});

test("TheTowerClient reads thread invocations", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new TheTowerClient({
    baseUrl: "http://localhost:3001/",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        invocations: [
          {
            id: "invocation-1",
            threadId: "thread-1",
            rootMessageId: "message-1",
            status: "done",
            targetAgents: ["agent-a", "agent-b"],
            routeMode: "fanout",
            depth: 0,
            createdAt: 1,
          },
        ],
      });
    },
  });

  const result = await client.getThreadInvocations("thread/1", 20);

  assert.equal(result.invocations[0]?.routeMode, "fanout");
  assert.equal(calls[0]?.url, "http://localhost:3001/api/threads/thread%2F1/invocations?limit=20");
});

test("AgentCallbackClient injects invocation auth into callback posts", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new AgentCallbackClient({
    baseUrl: "http://localhost:3001",
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "agent-a",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ messageId: "message-2", routed: ["agent-b"] });
    },
  });

  const result = await client.postMessage({ content: "@agent-b please review" });

  assert.deepEqual(result, { messageId: "message-2", routed: ["agent-b"] });
  assert.equal(calls[0]?.url, "http://localhost:3001/api/callbacks/post-message");
  assert.equal(
    calls[0]?.init?.body,
    JSON.stringify({
      invocationId: "invocation-1",
      callbackToken: "token-1",
      agentId: "agent-a",
      content: "@agent-b please review",
    }),
  );
});

test("AgentCallbackClient posts private handoff callback fields", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new AgentCallbackClient({
    baseUrl: "http://localhost:3001",
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "agent-a",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ messageId: "message-2", routed: ["agent-b"] });
    },
  });

  await client.postMessage({
    content: "@agent-b continue",
    targetAgents: ["agent-b"],
    routeMode: "single",
    visibility: "private",
    visibleToAgentIds: ["agent-b"],
    handoffPayload: {
      toAgentIds: ["agent-b"],
      what: "analysis done",
      why: "implementation needed",
      tradeoff: "keep public text short",
      nextAction: "implement tests",
    },
  });

  assert.equal(
    calls[0]?.init?.body,
    JSON.stringify({
      invocationId: "invocation-1",
      callbackToken: "token-1",
      agentId: "agent-a",
      content: "@agent-b continue",
      targetAgents: ["agent-b"],
      routeMode: "single",
      visibility: "private",
      visibleToAgentIds: ["agent-b"],
      handoffPayload: {
        toAgentIds: ["agent-b"],
        what: "analysis done",
        why: "implementation needed",
        tradeoff: "keep public text short",
        nextAction: "implement tests",
      },
    }),
  );
});

test("AgentCallbackClient reads thread context with query parameters", async () => {
  const urls: string[] = [];
  const client = new AgentCallbackClient({
    baseUrl: "http://localhost:3001",
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "agent-a",
    fetch: async (url) => {
      urls.push(String(url));
      return jsonResponse({ messages: [] });
    },
  });

  await client.getThreadContext("thread/a b", 50);

  assert.equal(
    urls[0],
    "http://localhost:3001/api/callbacks/thread-context?threadId=thread%2Fa+b&invocationId=invocation-1&callbackToken=token-1&limit=50",
  );
});

test("client throws a typed API error for non-2xx responses", async () => {
  const client = new TheTowerClient({
    baseUrl: "http://localhost:3001",
    fetch: async () => jsonResponse({ error: "invalid callback token" }, 400),
  });

  await assert.rejects(() => client.health(), {
    name: "TheTowerApiError",
    message: "invalid callback token",
    status: 400,
  } satisfies Partial<TheTowerApiError>);
});

test("TheTowerClient queries telemetry endpoints with filters", async () => {
  const urls: string[] = [];
  const client = new TheTowerClient({
    baseUrl: "http://localhost:3001/",
    fetch: async (url) => {
      urls.push(String(url));
      if (url.toString().includes("/telemetry/threads")) return jsonResponse({ threads: [] });
      if (url.toString().includes("/telemetry/tool-audit"))
        return jsonResponse({ rows: [], capability: "live_only" });
      if (url.toString().includes("/telemetry/events"))
        return jsonResponse({ events: [], capability: "live_only" });
      if (url.toString().includes("/invocations")) return jsonResponse({ invocations: [] });
      return jsonResponse({
        thread: { id: "t1", title: "T", createdAt: 1, updatedAt: 1 },
        messageCounts: { total: 0, public: 0, private: 0, revealed: 0, handoff: 0 },
        recentMessages: [],
        activeAgentIds: [],
        privateVisibility: [],
        recentFileToolAccess: [],
      });
    },
  });

  await client.getTelemetryThreads();
  await client.queryInvocations({ threadId: "t1", status: "running" });
  await client.queryTelemetryEvents({ agentId: "a1", type: "agent.event" });
  await client.queryToolAudit({ threadId: "t1" });
  await client.getThreadTelemetryContext("t/1");

  assert.deepEqual(urls, [
    "http://localhost:3001/api/telemetry/threads",
    "http://localhost:3001/api/invocations?threadId=t1&status=running",
    "http://localhost:3001/api/telemetry/events?agentId=a1&type=agent.event",
    "http://localhost:3001/api/telemetry/tool-audit?threadId=t1",
    "http://localhost:3001/api/threads/t%2F1/context",
  ]);
});

test("TheTowerClient reads workspace detail, activity, files, search", async () => {
  const urls: string[] = [];
  const client = new TheTowerClient({
    baseUrl: "http://localhost:3001/",
    fetch: async (url) => {
      urls.push(String(url));
      if (url.toString().endsWith("/activity")) {
        return jsonResponse({
          workspace: { id: "ws-1", name: "ws", projectPath: "/p", trustedAt: 1, lastOpenedAt: 1, createdAt: 1 },
          threads: [],
          activity: [],
          capability: "live_only",
        });
      }
      if (url.toString().includes("/files")) {
        return jsonResponse({ entries: [], capability: "unavailable" });
      }
      if (url.toString().includes("/search")) {
        return jsonResponse({ matches: [], capability: "unavailable" });
      }
      return jsonResponse({
        workspace: { id: "ws-1", name: "ws", projectPath: "/p", trustedAt: 1, lastOpenedAt: 1, createdAt: 1 },
      });
    },
  });

  await client.getWorkspace("ws/1");
  await client.getWorkspaceActivity("ws/1");
  await client.getWorkspaceFiles("ws/1", "src");
  await client.searchWorkspace("ws/1", "todo");

  assert.deepEqual(urls, [
    "http://localhost:3001/api/workspaces/ws%2F1",
    "http://localhost:3001/api/workspaces/ws%2F1/activity",
    "http://localhost:3001/api/workspaces/ws%2F1/files?path=src",
    "http://localhost:3001/api/workspaces/ws%2F1/search?q=todo",
  ]);
});

test("TheTowerClient creates and links task threads", async () => {
  const urls: string[] = [];
  const client = new TheTowerClient({
    baseUrl: "http://localhost:3001/",
    fetch: async (url, init) => {
      urls.push(`${init?.method ?? "GET"} ${String(url)}`);
      if (String(url).endsWith("/create-thread")) {
        return jsonResponse({
          task: {
            id: "t-1",
            title: "T",
            priority: "medium",
            status: "todo",
            tags: [],
            threadIds: ["th-1"],
            createdAt: 1,
            updatedAt: 1,
          },
          thread: { id: "th-1", title: "Task: T", createdAt: 1, updatedAt: 1 },
        });
      }
      return jsonResponse({
        task: {
          id: "t-1",
          title: "T",
          priority: "medium",
          status: "todo",
          tags: [],
          threadIds: [],
          createdAt: 1,
          updatedAt: 1,
        },
      });
    },
  });

  await client.createTask({ title: "T" });
  await client.createTaskThread("t/1", { content: "hello" });
  await client.getTaskThreads("t/1");

  assert.deepEqual(urls, [
    "POST http://localhost:3001/api/tasks",
    "POST http://localhost:3001/api/tasks/t%2F1/create-thread",
    "GET http://localhost:3001/api/tasks/t%2F1/threads",
  ]);
});

test("TheTowerClient creates threads and browses dirs", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new TheTowerClient({
    baseUrl: "http://localhost:3001/",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("/api/dirs")) {
        return jsonResponse({ path: "/home", entries: [{ name: "ai", path: "/home/ai" }] });
      }
      return jsonResponse({
        thread: { id: "th-1", title: "T", createdAt: 1, updatedAt: 1 },
      });
    },
  });

  const res = await client.createThread({ title: "T", projectPath: "/p", mode: "play" });
  const dirs = await client.listDirs("/home");

  assert.equal(res.thread.id, "th-1");
  assert.equal(calls[0]?.url, "http://localhost:3001/api/threads");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.body, JSON.stringify({ title: "T", projectPath: "/p", mode: "play" }));
  assert.equal(calls[1]?.url, "http://localhost:3001/api/dirs?path=%2Fhome");
  assert.equal(dirs.entries[0]?.name, "ai");
});

test("TheTowerClient binds the default global fetch implementation", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let boundThis: unknown;
    globalThis.fetch = function fakeFetch(this: unknown) {
      boundThis = this;
      return Promise.resolve(jsonResponse({ ok: true }));
    } as typeof fetch;

    const client = new TheTowerClient({ baseUrl: "http://localhost:3001" });
    await client.health();

    assert.equal(boundThis, globalThis);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
