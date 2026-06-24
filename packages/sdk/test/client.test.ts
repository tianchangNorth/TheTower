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

  assert.equal(urls[0], "http://localhost:3001/api/callbacks/thread-context?threadId=thread%2Fa+b&limit=50");
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
