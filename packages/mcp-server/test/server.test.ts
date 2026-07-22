import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  AgentCallbackHttpClient,
  createTheTowerMcpServer,
  TheTowerCallbackError,
  type CallbackClient,
} from "../src/index.js";
import { callbackToolResult } from "../src/tools/result.js";

test("MCP callback client relies on bearer grant identity instead of sending agentId", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const client = new AgentCallbackHttpClient({
    baseUrl: "http://tower.test",
    invocationId: "invocation-1",
    callbackToken: "token-1",
    fetch: async (url, init) => {
      request = { url: String(url), init };
      return new Response(JSON.stringify({ messageId: "message-1", routed: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await client.postMessage({ content: "Done" });

  assert.equal(request?.url, "http://tower.test/api/callbacks/post-message");
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    invocationId: "invocation-1",
    content: "Done",
  });
  assert.equal((request?.init?.headers as Record<string, string>)["x-the-tower-carrier"], "mcp");
});

test("MCP callback client preserves stable service code and details", async () => {
  const client = new AgentCallbackHttpClient({
    baseUrl: "http://tower.test",
    invocationId: "invocation-1",
    callbackToken: "token-1",
    fetch: async () => new Response(JSON.stringify({
      error: "private callback requires a recipient",
      code: "private_recipient_required",
      details: { senderAgentId: "zavala" },
    }), { status: 400, headers: { "content-type": "application/json" } }),
  });

  await assert.rejects(
    () => client.postMessage({ content: "private", visibility: "private" }),
    (err: unknown) => {
      assert.equal(err instanceof TheTowerCallbackError, true);
      const callbackError = err as TheTowerCallbackError;
      assert.equal(callbackError.status, 400);
      assert.equal(callbackError.code, "private_recipient_required");
      assert.deepEqual(callbackError.details, { senderAgentId: "zavala" });
      return true;
    },
  );
});

test("MCP tool errors expose the stable service code instead of only prose", async () => {
  const result = await callbackToolResult(async () => {
    throw Object.assign(new Error("unknown target agent"), {
      code: "unknown_agent",
      details: { agentIds: ["missing-agent"] },
    });
  });

  assert.equal(result.isError, true);
  assert.deepEqual(JSON.parse(result.content[0]?.text ?? "{}"), {
    error: "unknown target agent",
    code: "unknown_agent",
    details: { agentIds: ["missing-agent"] },
  });
});

test("the-tower MCP server exposes callback tools", async () => {
  const previousAllowedWorkspaceDirs = process.env.ALLOWED_WORKSPACE_DIRS;
  process.env.ALLOWED_WORKSPACE_DIRS = process.cwd();
  const calls: Array<{ name: string; input: unknown }> = [];
  const callbackClient: CallbackClient = {
    async postMessage(input) {
      calls.push({ name: "postMessage", input });
      return { messageId: "message-1", routed: ["agent-b"] };
    },
    async getThreadContext(threadId, limit) {
      calls.push({ name: "getThreadContext", input: { threadId, limit } });
      return {
        messages: [
          {
            id: "message-1",
            threadId,
            senderType: "user",
            content: "hello",
            mentions: [],
            createdAt: 1,
          },
        ],
      };
    },
    async readFile(input) {
      calls.push({ name: "readFile", input });
      return { path: "/workspace/README.md", content: "hello" };
    },
    async readFileSlice(input) {
      calls.push({ name: "readFileSlice", input });
      return { path: "/workspace/README.md", startLine: input.startLine, endLine: input.endLine ?? input.startLine, content: "1: hello" };
    },
    async listFiles(input) {
      calls.push({ name: "listFiles", input });
      return { path: "/workspace", entries: ["README.md"], truncated: false };
    },
    async writeFile(input) {
      calls.push({ name: "writeFile", input });
      return { path: `/workspace/${input.path}`, bytes: input.content.length };
    },
  };

  const server = createTheTowerMcpServer({ callbackClient, threadId: "thread-1", toolsetEnv: { profile: "full" } });
  const client = new Client({ name: "test-client", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name).sort(),
      ["get_thread_context", "list_files", "post_message", "read_file", "read_file_slice", "shell_exec", "write_file"],
    );

    const postResult = await client.callTool({
      name: "post_message",
      arguments: {
        content: "@agent-b please review",
        targetAgents: ["agent-b"],
        visibility: "private",
        visibleToAgentIds: ["agent-b"],
        handoffPayload: {
          toAgentIds: ["agent-b"],
          what: "analysis done",
          why: "implementation needed",
          tradeoff: "keep public text short",
          nextAction: "review implementation",
        },
      },
    });
    assert.equal(firstText(postResult.content), JSON.stringify({ messageId: "message-1", routed: ["agent-b"] }));

    const contextResult = await client.callTool({
      name: "get_thread_context",
      arguments: { limit: 25 },
    });
    assert.match(firstText(contextResult.content), /"threadId":"thread-1"/);

    const readResult = await client.callTool({
      name: "read_file",
      arguments: { path: "README.md" },
    });
    assert.match(firstText(readResult.content), /File: \/workspace\/README\.md\nhello/);

    const writeResult = await client.callTool({
      name: "write_file",
      arguments: { path: "notes.md", content: "hello" },
    });
    assert.equal(firstText(writeResult.content), "Wrote 5 bytes to /workspace/notes.md");

    const shellResult = await client.callTool({
      name: "shell_exec",
      arguments: { commandLine: "pwd" },
    });
    assert.match(firstText(shellResult.content), /Status: success/);

    assert.deepEqual(calls, [
      {
        name: "postMessage",
        input: {
          content: "@agent-b please review",
          targetAgents: ["agent-b"],
          visibility: "private",
          visibleToAgentIds: ["agent-b"],
          handoffPayload: {
            toAgentIds: ["agent-b"],
            what: "analysis done",
            why: "implementation needed",
            tradeoff: "keep public text short",
            nextAction: "review implementation",
          },
        },
      },
      {
        name: "getThreadContext",
        input: { threadId: "thread-1", limit: 25 },
      },
      {
        name: "readFile",
        input: { path: "README.md" },
      },
      {
        name: "writeFile",
        input: { path: "notes.md", content: "hello" },
      },
    ]);
  } finally {
    if (previousAllowedWorkspaceDirs === undefined) delete process.env.ALLOWED_WORKSPACE_DIRS;
    else process.env.ALLOWED_WORKSPACE_DIRS = previousAllowedWorkspaceDirs;
    await client.close();
    await server.close();
  }
});

function firstText(content: Awaited<ReturnType<Client["callTool"]>>["content"]): string {
  const first = content[0];
  assert.equal(first?.type, "text");
  return first.text;
}
