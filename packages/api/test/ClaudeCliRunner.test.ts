import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  buildClaudeMcpConfig,
  ClaudeCliRunner,
  extractClaudeUsage,
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

test("extractClaudeUsage normalizes cache tokens and context window", () => {
  const usage = extractClaudeUsage({
    type: "result",
    usage: {
      input_tokens: 100,
      output_tokens: 40,
      cache_read_input_tokens: 30,
      cache_creation_input_tokens: 20,
    },
    total_cost_usd: 0.0123,
    duration_ms: 1500,
    duration_api_ms: 1200,
    num_turns: 2,
    modelUsage: {
      "claude-sonnet": {
        contextWindow: 200_000,
      },
    },
  });

  assert.deepEqual(usage, {
    inputTokens: 150,
    outputTokens: 40,
    cacheReadTokens: 30,
    cacheCreationTokens: 20,
    costUsd: 0.0123,
    durationMs: 1500,
    durationApiMs: 1200,
    numTurns: 2,
    contextWindowSize: 200_000,
    budgetTokens: 200_000,
    lastTurnInputTokens: 150,
    source: "provider",
  });
});

test("parseClaudeStreamJson extracts result usage", () => {
  const stdout = JSON.stringify({
    type: "result",
    result: "result answer",
    usage: {
      input_tokens: 10,
      output_tokens: 5,
    },
  });

  assert.deepEqual(parseClaudeStreamJson(stdout), {
    content: "result answer",
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      lastTurnInputTokens: 10,
      source: "provider",
    },
  });
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
          [
            JSON.stringify({
              type: "assistant",
              message: {
                role: "assistant",
                content: [{ type: "text", text: "Claude final answer" }],
              },
            }),
            JSON.stringify({
              type: "result",
              usage: { input_tokens: 12, output_tokens: 6 },
            }),
          ].join("\n"),
        );
        child.emit("close", 0, null);
      });
      return child;
    },
  });

  const events = [];
  for await (const event of runner.run(makeRunInput())) events.push(event);

  assert.equal(calls[0]?.command, "claude-test");
  assert.deepEqual(calls[0]?.args.slice(0, 7), [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    "sonnet",
    "--append-system-prompt",
  ]);
  const systemArg = calls[0]?.args[calls[0].args.indexOf("--append-system-prompt") + 1];
  assert.ok(systemArg);
  assert.match(systemArg, /你是 架构师/);
  assert.match(systemArg, /角色：你负责系统架构设计/);
  assert.match(systemArg, /签名 \[架构师\/sonnet🐾\]/);
  assert.match(systemArg, /运行中写回工具/);
  assert.match(systemArg, /Reviewer \(agent-b\): handles=@agent-b \/ @reviewer/);
  assert.equal(calls[0]?.args[calls[0].args.indexOf("--permission-mode") + 1], "acceptEdits");
  assert.ok(calls[0]?.args.includes("--strict-mcp-config"));
  assert.deepEqual(calls[0]?.args.slice(calls[0].args.indexOf("--allowedTools"), calls[0].args.indexOf("--allowedTools") + 2), [
    "--allowedTools",
    "mcp__thetower__post_message,mcp__thetower__get_thread_context,mcp__thetower__read_file,mcp__thetower__read_file_slice,mcp__thetower__list_files,mcp__thetower__write_file,mcp__thetower__shell_exec",
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
  const stdin = calls[0]?.stdin ?? "";
  assert.match(stdin, /threadId: thread-1/);
  assert.match(stdin, /当前 routeMode/);
  assert.match(stdin, /Thread Orchestration/);
  assert.match(stdin, /A2A Channel Semantics/);
  assert.match(stdin, /只有行首 mention 会触发路由/);
  assert.match(stdin, /不要为了普通 `@队友` 调 callback/);
  assert.match(stdin, /不同内容的 final reply 是正常发言/);
  assert.match(stdin, /不要声称“已私密送达”/);
  assert.equal(calls[0]?.env.THE_TOWER_AGENT_ID, "agent-a");
  assert.equal(calls[0]?.env.THE_TOWER_CALLBACK_TOKEN, "token-1");
  assert.equal(calls[0]?.env.THE_TOWER_API_URL, "http://127.0.0.1:3999");
  assert.deepEqual(events, [
    {
      type: "token_usage",
      usage: { inputTokens: 12, outputTokens: 6, lastTurnInputTokens: 12, source: "provider" },
    },
    { type: "text", content: "Claude final answer" },
    { type: "done" },
  ]);
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

test("ClaudeCliRunner uses invocation workingDirectory for spawn cwd", async () => {
  const calls: Array<{ cwd: string | undefined }> = [];
  const runner = new ClaudeCliRunner({
    command: "claude-test",
    cwd: "/tmp/the-tower-default",
    timeoutMs: 1000,
    env: {},
    spawn: (_command, _args, options) => {
      const child = new EventEmitter() as any;
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = () => true;
      child.stdin.on("finish", () => {
        calls.push({ cwd: options.cwd });
        child.stdout.end(JSON.stringify({ type: "result", result: "ok" }));
        child.emit("close", 0, null);
      });
      return child;
    },
  });

  const events = [];
  for await (const event of runner.run({ ...makeRunInput(), workingDirectory: "/tmp/the-tower-workspace" })) {
    events.push(event);
  }

  assert.equal(calls[0]?.cwd, "/tmp/the-tower-workspace");
  assert.deepEqual(events, [{ type: "text", content: "ok" }, { type: "done" }]);
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

test("ClaudeCliRunner condenses upstream data inspection failures", async () => {
  const rawProviderError = [
    "API Error: 400 event:error",
    'data:{"request_id":"request-1","code":"InvalidParameter","message":"data: {\\"error\\":{\\"code\\":\\"data_inspection_failed\\",\\"message\\":\\"Input text data may contain inappropriate content.\\"}}"}',
  ].join("\n");
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
        child.stderr.end(rawProviderError);
        child.emit("close", 1, null);
      });
      return child;
    },
  });

  const events = [];
  for await (const event of runner.run(makeRunInput())) events.push(event);

  assert.deepEqual(events, [
    {
      type: "error",
      error: "Claude CLI 请求被上游内容检查拒绝（data_inspection_failed）。请移除或缩短可能触发审查的最近消息/上下文后重试。",
    },
  ]);
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
      persona: { roleDescription: "你负责系统架构设计", personality: "沉稳克制", strengths: ["架构"], restrictions: [] },
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
        persona: { roleDescription: "你负责系统架构设计", personality: "沉稳克制", strengths: ["架构"], restrictions: [] },
        enabled: true,
        createdAt: 1,
      },
      {
        id: "agent-b",
        displayName: "Reviewer",
        mentionHandles: ["@agent-b", "@reviewer"],
        provider: "codex",
        model: "gpt-5",
        persona: { roleDescription: "你负责代码审查", personality: "尖锐直接", strengths: ["评审"], restrictions: [] },
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
        id: "a2a-channel-semantics",
        name: "A2A Channel Semantics",
        priority: 130,
        prompt: [
          "不要为了普通 `@队友` 调 callback。",
          "不同内容的 final reply 是正常发言。",
          "没有显式私密写回成功，不要声称“已私密送达”。",
        ].join("\n"),
      },
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
