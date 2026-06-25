import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  buildClaudeMcpConfig,
  ClaudeCliRunner,
  parseClaudeStreamJson,
} from "../src/agents/runners/ClaudeCliRunner.js";
import type { AgentRunInput } from "../src/types.js";

test("parseClaudeStreamJson extracts assistant message text", () => {
  const stdout = [
    JSON.stringify({ type: "system", subtype: "init" }),
    JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Claude final answer" }],
      },
    }),
    JSON.stringify({ type: "result", result: "fallback result" }),
  ].join("\n");

  assert.deepEqual(parseClaudeStreamJson(stdout), { content: "Claude final answer" });
});

test("parseClaudeStreamJson falls back to result text", () => {
  const stdout = JSON.stringify({ type: "result", result: "result answer" });

  assert.deepEqual(parseClaudeStreamJson(stdout), { content: "result answer" });
});

test("ClaudeCliRunner invokes claude and yields parsed assistant output", async () => {
  const calls: Array<{ command: string; args: string[]; stdin: string; env: NodeJS.ProcessEnv }> = [];
  const runner = new ClaudeCliRunner({
    command: "claude-test",
    cwd: "/tmp/the-tower-test",
    permissionMode: "acceptEdits",
    mcpServerCommand: "node-test",
    mcpServerArgs: ["mcp-server.js"],
    apiBaseUrl: "http://127.0.0.1:3999",
    timeoutMs: 1000,
    env: {},
    spawn: (command, args, options) => {
      const child = new EventEmitter() as any;
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = () => true;
      let stdin = "";
      child.stdin.on("data", (chunk: Buffer) => {
        stdin += chunk.toString("utf8");
      });
      child.stdin.on("finish", () => {
        calls.push({ command, args, stdin, env: options.env ?? {} });
        child.stdout.end(
          `${JSON.stringify({
            type: "assistant",
            message: {
              role: "assistant",
              content: [{ type: "text", text: "Claude final answer" }],
            },
          })}\n`,
        );
        child.emit("close", 0, null);
      });
      return child;
    },
  });

  const events = [];
  for await (const event of runner.run(makeRunInput())) events.push(event);

  assert.equal(calls[0]?.command, "claude-test");
  assert.deepEqual(calls[0]?.args.slice(0, 8), [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    "sonnet",
    "--permission-mode",
    "acceptEdits",
  ]);
  assert.ok(calls[0]?.args.includes("--strict-mcp-config"));
  assert.deepEqual(calls[0]?.args.slice(calls[0].args.indexOf("--allowedTools"), calls[0].args.indexOf("--allowedTools") + 2), [
    "--allowedTools",
    "mcp__thetower__post_message,mcp__thetower__get_thread_context",
  ]);
  const mcpConfigArg = calls[0]?.args[calls[0].args.indexOf("--mcp-config") + 1];
  assert.ok(mcpConfigArg);
  assert.deepEqual(JSON.parse(mcpConfigArg), {
    mcpServers: {
      thetower: {
        command: "node-test",
        args: ["mcp-server.js"],
        env: {
          THE_TOWER_API_URL: "http://127.0.0.1:3999",
          THE_TOWER_AGENT_ID: "agent-a",
          THE_TOWER_THREAD_ID: "thread-1",
          THE_TOWER_INVOCATION_ID: "invocation-1",
          THE_TOWER_CALLBACK_TOKEN: "token-1",
        },
      },
    },
  });
  assert.match(calls[0]?.stdin ?? "", /Agent ID: agent-a/);
  assert.match(calls[0]?.stdin ?? "", /Thread Orchestration/);
  assert.match(calls[0]?.stdin ?? "", /只有行首 mention 会触发路由/);
  assert.match(calls[0]?.stdin ?? "", /运行中写回工具/);
  assert.match(calls[0]?.stdin ?? "", /Reviewer \(agent-b\): handles=@agent-b/);
  assert.equal(calls[0]?.env.THE_TOWER_AGENT_ID, "agent-a");
  assert.equal(calls[0]?.env.THE_TOWER_CALLBACK_TOKEN, "token-1");
  assert.equal(calls[0]?.env.THE_TOWER_API_URL, "http://127.0.0.1:3999");
  assert.deepEqual(events, [{ type: "text", content: "Claude final answer" }, { type: "done" }]);
});

test("buildClaudeMcpConfig creates a dynamic the-tower MCP server config", () => {
  assert.deepEqual(
    buildClaudeMcpConfig({
      command: "node",
      args: ["dist/index.js"],
      env: { THE_TOWER_AGENT_ID: "agent-a" },
    }),
    {
      mcpServers: {
        thetower: {
          command: "node",
          args: ["dist/index.js"],
          env: { THE_TOWER_AGENT_ID: "agent-a" },
        },
      },
    },
  );
});

test("ClaudeCliRunner yields an error when claude exits unsuccessfully", async () => {
  const runner = new ClaudeCliRunner({
    command: "claude-test",
    timeoutMs: 1000,
    env: {},
    spawn: () => {
      const child = new EventEmitter() as any;
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = () => true;
      child.stdin.on("finish", () => {
        child.stderr.end("auth failed");
        child.emit("close", 1, null);
      });
      return child;
    },
  });

  const events = [];
  for await (const event of runner.run(makeRunInput())) events.push(event);

  assert.equal(events.length, 1);
  assert.equal(events[0]?.type, "error");
  assert.match(events[0]?.type === "error" ? events[0].error : "", /auth failed/);
});

test("ClaudeCliRunner kills the child process when aborted", async () => {
  const controller = new AbortController();
  let killed = false;
  const runner = new ClaudeCliRunner({
    command: "claude-test",
    timeoutMs: 1000,
    env: {},
    spawn: () => {
      const child = new EventEmitter() as any;
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = () => {
        killed = true;
        queueMicrotask(() => child.emit("close", null, "SIGTERM"));
        return true;
      };
      child.stdin.on("finish", () => {
        controller.abort();
      });
      return child;
    },
  });

  const events = [];
  for await (const event of runner.run({ ...makeRunInput(), signal: controller.signal })) events.push(event);

  assert.equal(killed, true);
  assert.deepEqual(events, [{ type: "error", error: "Claude CLI invocation was aborted." }]);
});

function makeRunInput(): AgentRunInput {
  return {
    agent: {
      id: "agent-a",
      displayName: "架构师",
      mentionHandles: ["@agent-a"],
      provider: "claude",
      model: "sonnet",
      rolePrompt: "你负责系统架构设计。",
      enabled: true,
      createdAt: 1,
    },
    availableAgents: [
      {
        id: "agent-a",
        displayName: "架构师",
        mentionHandles: ["@agent-a"],
        provider: "claude",
        model: "sonnet",
        rolePrompt: "你负责系统架构设计。",
        enabled: true,
        createdAt: 1,
      },
      {
        id: "agent-b",
        displayName: "Reviewer",
        mentionHandles: ["@agent-b", "@reviewer"],
        provider: "codex",
        model: "gpt-5",
        rolePrompt: "你负责代码审查。",
        enabled: true,
        createdAt: 2,
      },
    ],
    worklistAgents: ["agent-a", "agent-b"],
    worklistIndex: 0,
    a2aEnabled: true,
    threadId: "thread-1",
    invocationId: "invocation-1",
    callbackToken: "token-1",
    activeSkills: [
      {
        id: "thread-orchestration",
        name: "Thread Orchestration",
        priority: 120,
        prompt: "只有行首 mention 会触发路由。",
      },
    ],
    signal: new AbortController().signal,
    messages: [
      {
        id: "message-1",
        threadId: "thread-1",
        senderType: "user",
        content: "@agent-a 设计方案",
        mentions: ["agent-a"],
        createdAt: 1,
      },
    ],
  };
}
