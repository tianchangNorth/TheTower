import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTheTowerMcpServer, type CallbackClient } from "../src/index.js";

test("the-tower MCP server exposes callback tools", async () => {
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
  };

  const server = createTheTowerMcpServer({ callbackClient, threadId: "thread-1" });
  const client = new Client({ name: "test-client", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name).sort(),
      ["get_thread_context", "post_message"],
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
          replyTo: undefined,
        },
      },
      {
        name: "getThreadContext",
        input: { threadId: "thread-1", limit: 25 },
      },
    ]);
  } finally {
    await client.close();
    await server.close();
  }
});

function firstText(content: Awaited<ReturnType<Client["callTool"]>>["content"]): string {
  const first = content[0];
  assert.equal(first?.type, "text");
  return first.text;
}
