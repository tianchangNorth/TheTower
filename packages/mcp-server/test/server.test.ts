import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTheTowerMcpServer, type CallbackClient } from "../src/index.js";

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

  const server = createTheTowerMcpServer({ callbackClient, threadId: "thread-1" });
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
        routeMode: "single",
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
          routeMode: "single",
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
