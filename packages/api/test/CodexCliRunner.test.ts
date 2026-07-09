import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import { buildCallbackRuntimeEnv, resolveCallbackBaseUrl } from "../src/agents/runners/CallbackRuntimeEnv.js";
import { buildCodexPrompt, CodexCliRunner } from "../src/agents/runners/CodexCliRunner.js";
import type { AgentRunInput } from "../src/types.js";

test("buildCodexPrompt formats agent identity, rules, and thread messages", () => {
  const parts = buildCodexPrompt(makeRunInput());
  const prompt = `${parts.system}\n\n---\n${parts.user}`;

  assert.match(prompt, /你是 架构师/);
  assert.match(prompt, /id=agent-a/);
  assert.match(prompt, /角色：你负责系统架构设计/);
  assert.match(prompt, /当前调用上下文/);
  assert.match(prompt, /串行位置: 1\/2/);
  assert.match(prompt, /平台铁律/);
  assert.match(prompt, /具体协作行为、A2A 路由和交接格式以当前启用 Skills 为准/);
  assert.match(prompt, /可协作 Agent 名册/);
  assert.match(prompt, /Reviewer \(agent-b\): handles=@agent-b/);
  assert.match(prompt, /当前启用 Skills/);
  assert.match(prompt, /Thread Orchestration/);
  assert.match(prompt, /只有行首 mention 会触发路由/);
  assert.match(prompt, /Cross Agent Handoff/);
  assert.match(prompt, /交接消息必须包含/);
  assert.match(prompt, /A2A Channel Semantics/);
  assert.match(prompt, /要在 thread 公共区发言，必须调用/);
  assert.match(prompt, /不同内容的 final reply 是正常发言/);
  assert.match(prompt, /## Callback API 能力入口/);
  assert.match(prompt, /以当前启用 Skills 为准/);
  assert.match(prompt, /mcp__thetower__post_message/);
  assert.match(prompt, /mcp__thetower__write_file/);
  assert.match(prompt, /mcp__thetower__shell_exec/);
  assert.match(prompt, /workspace 边界/);
  assert.match(prompt, /HTTP curl 只是 fallback/);
  assert.match(prompt, /api\/callbacks\/post-message/);
  assert.match(prompt, /api\/callbacks\/thread-context/);
  assert.match(prompt, /"visibility": "private"/);
  assert.match(prompt, /visibleToAgentIds/);
  assert.match(prompt, /不要声称“已私密送达”/);
  assert.match(prompt, /handoffPayload/);
  assert.match(prompt, /THE_TOWER_CALLBACK_TOKEN/);
  assert.doesNotMatch(prompt, /token-1/);
  assert.match(prompt, /sender=user mentions=agent-a/);
  assert.match(prompt, /@agent-a 设计方案/);
});

test("CodexCliRunner invokes codex exec and yields last message output", async () => {
  const calls: Array<{ command: string; args: string[]; stdin: string; env: NodeJS.ProcessEnv }> = [];
  const runner = new CodexCliRunner({
    command: "codex-test",
    cwd: "/tmp/the-tower-test",
    sandbox: "read-only",
    approvalPolicy: "never",
    mcpServerCommand: "node-test",
    mcpServerArgs: ["mcp-server.js"],
    timeoutMs: 1000,
    env: {},
    spawn: (command, args, options) => {
      const child = new EventEmitter() as any;
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = () => true;
      child.stdin.on("finish", () => {
        child.stdout.end(codexJsonLines([
          { type: "item.completed", item: { type: "reasoning", text: "Thinking through the task" } },
          { type: "item.completed", item: { type: "agent_message", text: "Codex final answer" } },
        ]));
        calls.push({ command, args, stdin: child.stdin.read()?.toString("utf8") ?? "", env: options.env ?? {} });
        setImmediate(() => child.emit("close", 0, null));
      });
      return child;
    },
  });

  const events = [];
  for await (const event of runner.run(makeRunInput())) events.push(event);

  assert.equal(calls[0]?.command, "codex-test");
  assert.deepEqual(calls[0]?.args.slice(0, 3), ["--ask-for-approval", "never", "exec"]);
  assert.ok(calls[0]?.args.includes("--json"));
  assert.equal(calls[0]?.args.includes("--output-last-message"), false);
  assert.match(calls[0]?.stdin ?? "", /id=agent-a/);
  assert.match(calls[0]?.stdin ?? "", /## Callback API 能力入口/);
  assert.equal(calls[0]?.env.THE_TOWER_API_URL, "http://127.0.0.1:3001");
  assert.equal(calls[0]?.env.THE_TOWER_CALLBACK_TOKEN, "token-1");
  assert.equal(calls[0]?.env.THE_TOWER_INVOCATION_ID, "invocation-1");
  assertMcpConfigArgs(calls[0]?.args ?? [], {
    command: "node-test",
    args: ["mcp-server.js"],
    env: buildCallbackRuntimeEnv(makeRunInput(), "http://127.0.0.1:3001"),
  });
  assert.deepEqual(events, [
    { type: "thinking", content: "Thinking through the task", mode: "block" },
    { type: "text", content: "Codex final answer" },
    { type: "done" },
  ]);
});

test("CodexCliRunner defaults to cat-cafe style full-access sandbox with dynamic MCP env", async () => {
  const calls: Array<{ args: string[] }> = [];
  const runner = new CodexCliRunner({
    command: "codex-test",
    cwd: "/tmp/the-tower-test",
    timeoutMs: 1000,
    env: {},
    spawn: (_command, args) => {
      const child = new EventEmitter() as any;
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = () => true;
      child.stdin.on("finish", () => {
        child.stdout.end(codexJsonLines([{ type: "item.completed", item: { type: "agent_message", text: "ok" } }]));
        calls.push({ args });
        setImmediate(() => child.emit("close", 0, null));
      });
      return child;
    },
  });

  const events = [];
  for await (const event of runner.run(makeRunInput())) events.push(event);

  assert.equal(calls[0]?.args[calls[0].args.indexOf("--ask-for-approval") + 1], "on-request");
  assert.equal(calls[0]?.args[calls[0].args.indexOf("--sandbox") + 1], "danger-full-access");
  assert.equal(calls[0]?.args.includes("sandbox_workspace_write.network_access=true"), false);
  assertMcpConfigArgs(calls[0]?.args ?? [], {
    env: buildCallbackRuntimeEnv(makeRunInput(), "http://127.0.0.1:3001"),
  });
  assert.deepEqual(events, [{ type: "text", content: "ok" }, { type: "done" }]);
});

test("CodexCliRunner enables network proxy when workspace-write sandbox is selected", async () => {
  const calls: Array<{ args: string[] }> = [];
  const runner = new CodexCliRunner({
    command: "codex-test",
    cwd: "/tmp/the-tower-test",
    sandbox: "workspace-write",
    timeoutMs: 1000,
    env: {},
    spawn: (_command, args) => {
      const child = new EventEmitter() as any;
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = () => true;
      child.stdin.on("finish", () => {
        child.stdout.end(codexJsonLines([{ type: "item.completed", item: { type: "agent_message", text: "ok" } }]));
        calls.push({ args });
        setImmediate(() => child.emit("close", 0, null));
      });
      return child;
    },
  });

  const events = [];
  for await (const event of runner.run(makeRunInput())) events.push(event);

  assert.deepEqual(calls[0]?.args.slice(calls[0].args.indexOf("--enable"), calls[0].args.indexOf("--enable") + 2), [
    "--enable",
    "network_proxy",
  ]);
  assert.ok(calls[0]?.args.includes("sandbox_workspace_write.network_access=true"));
  assert.equal(calls[0]?.args.includes("features.network_proxy.enabled=true"), false);
  assert.deepEqual(events, [{ type: "text", content: "ok" }, { type: "done" }]);
});

test("CodexCliRunner uses invocation workingDirectory for spawn cwd, --cd, and MCP allowed dirs", async () => {
  const calls: Array<{ args: string[]; cwd: string | undefined }> = [];
  const runner = new CodexCliRunner({
    command: "codex-test",
    cwd: "/tmp/the-tower-default",
    timeoutMs: 1000,
    env: {},
    spawn: (_command, args, options) => {
      const child = new EventEmitter() as any;
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = () => true;
      child.stdin.on("finish", () => {
        child.stdout.end(codexJsonLines([{ type: "item.completed", item: { type: "agent_message", text: "ok" } }]));
        calls.push({ args, cwd: options.cwd });
        setImmediate(() => child.emit("close", 0, null));
      });
      return child;
    },
  });

  const events = [];
  for await (const event of runner.run({ ...makeRunInput(), workingDirectory: "/tmp/the-tower-workspace" })) {
    events.push(event);
  }

  assert.equal(calls[0]?.cwd, "/tmp/the-tower-workspace");
  assert.equal(calls[0]?.args[calls[0].args.indexOf("--cd") + 1], "/tmp/the-tower-workspace");
  assert.ok(calls[0]?.args.includes('mcp_servers.thetower.env.ALLOWED_WORKSPACE_DIRS="/tmp/the-tower-workspace"'));
  assert.deepEqual(events, [{ type: "text", content: "ok" }, { type: "done" }]);
});

test("resolveCallbackBaseUrl keeps explicit and legacy API URL precedence", () => {
  assert.equal(resolveCallbackBaseUrl({ apiBaseUrl: "http://explicit.test", env: {} }), "http://explicit.test");
  assert.equal(resolveCallbackBaseUrl({ env: { THE_TOWER_API_URL: "http://api.test" } }), "http://api.test");
});

function codexJsonLines(events: unknown[]): string {
  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}

function assertMcpConfigArgs(
  args: string[],
  expected: {
    command?: string;
    args?: string[];
    env: Record<string, string>;
  },
): void {
  if (expected.command) {
    assert.ok(args.includes(`mcp_servers.thetower.command=${JSON.stringify(expected.command)}`));
  }
  if (expected.args) {
    assert.ok(args.includes(`mcp_servers.thetower.args=[${expected.args.map((arg) => JSON.stringify(arg)).join(", ")}]`));
  }
  assert.ok(args.includes("mcp_servers.thetower.enabled=true"));
  assert.ok(args.includes('mcp_servers.thetower.default_tools_approval_mode="approve"'));
  for (const [key, value] of Object.entries(expected.env)) {
    assert.ok(args.includes(`mcp_servers.thetower.env.${key}=${JSON.stringify(value)}`));
  }
}

test("CodexCliRunner yields an error when codex exits unsuccessfully", async () => {
  const runner = new CodexCliRunner({
    command: "codex-test",
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
        child.stdout.end();
        setImmediate(() => child.emit("close", 1, null));
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

function makeRunInput(): AgentRunInput {
  return {
    agent: {
      id: "agent-a",
      displayName: "架构师",
      mentionHandles: ["@agent-a"],
      provider: "codex",
      model: "gpt-5",
      persona: { roleDescription: "你负责系统架构设计", personality: "沉稳克制", strengths: ["架构"], restrictions: [] },
      enabled: true,
      createdAt: 1,
    },
    availableAgents: [
      {
        id: "agent-a",
        displayName: "架构师",
        mentionHandles: ["@agent-a"],
        provider: "codex",
        model: "gpt-5",
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
          "要在 thread 公共区发言，必须调用 post_message。",
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
      {
        id: "cross-agent-handoff",
        name: "Cross Agent Handoff",
        priority: 100,
        prompt: "交接消息必须包含 What / Why / Next Action。",
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
