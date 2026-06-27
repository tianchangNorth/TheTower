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
          rolePrompt: "",
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
