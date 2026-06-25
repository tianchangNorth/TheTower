import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { writeFile } from "node:fs/promises";
import { PassThrough } from "node:stream";
import test from "node:test";
import { buildCodexPrompt, CodexCliRunner } from "../src/agents/runners/CodexCliRunner.js";
import type { AgentRunInput } from "../src/types.js";

test("buildCodexPrompt formats agent identity, rules, and thread messages", () => {
  const prompt = buildCodexPrompt(makeRunInput());

  assert.match(prompt, /Agent ID: agent-a/);
  assert.match(prompt, /Agent 名称: 架构师/);
  assert.match(prompt, /你负责系统架构设计。/);
  assert.match(prompt, /当前协作状态/);
  assert.match(prompt, /串行位置: 1\/2/);
  assert.match(prompt, /只有在需要把任务继续转交给其他 Agent/);
  assert.match(prompt, /A2A 转交必须把 mention 放在独立一行的行首/);
  assert.match(prompt, /A2A 球权检查/);
  assert.match(prompt, /如果你是最后一棒，且原始任务要求发起者汇总或收束/);
  assert.match(prompt, /可协作 Agent 名册/);
  assert.match(prompt, /Reviewer \(agent-b\): handles=@agent-b/);
  assert.match(prompt, /确认、致谢、总结、已完成这类消息不要带任何 @mention/);
  assert.match(prompt, /## 协作方式补充/);
  assert.match(prompt, /### @队友/);
  assert.match(prompt, /### HTTP 回调（异步）/);
  assert.match(prompt, /不要为了普通 @队友 去调用 callback/);
  assert.match(prompt, /api\/callbacks\/post-message/);
  assert.match(prompt, /api\/callbacks\/thread-context/);
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
    timeoutMs: 1000,
    env: {},
    spawn: (command, args, options) => {
      const child = new EventEmitter() as any;
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = () => true;
      child.stdin.on("finish", async () => {
        const outputFile = args[args.indexOf("--output-last-message") + 1];
        assert.ok(outputFile);
        await writeFile(outputFile, "Codex final answer");
        calls.push({ command, args, stdin: child.stdin.read()?.toString("utf8") ?? "", env: options.env ?? {} });
        child.emit("close", 0, null);
      });
      return child;
    },
  });

  const events = [];
  for await (const event of runner.run(makeRunInput())) events.push(event);

  assert.equal(calls[0]?.command, "codex-test");
  assert.deepEqual(calls[0]?.args.slice(0, 4), ["--ask-for-approval", "never", "exec", "--sandbox"]);
  assert.ok(calls[0]?.args.includes("--output-last-message"));
  assert.match(calls[0]?.stdin ?? "", /Agent ID: agent-a/);
  assert.match(calls[0]?.stdin ?? "", /### HTTP 回调（异步）/);
  assert.equal(calls[0]?.env.THE_TOWER_API_URL, "http://127.0.0.1:3001");
  assert.equal(calls[0]?.env.THE_TOWER_CALLBACK_TOKEN, "token-1");
  assert.equal(calls[0]?.env.THE_TOWER_INVOCATION_ID, "invocation-1");
  assert.deepEqual(events, [{ type: "text", content: "Codex final answer" }, { type: "done" }]);
});

test("CodexCliRunner enables localhost callback networking by default", async () => {
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
      child.stdin.on("finish", async () => {
        const outputFile = args[args.indexOf("--output-last-message") + 1];
        assert.ok(outputFile);
        await writeFile(outputFile, "ok");
        calls.push({ args });
        child.emit("close", 0, null);
      });
      return child;
    },
  });

  const events = [];
  for await (const event of runner.run(makeRunInput())) events.push(event);

  assert.equal(calls[0]?.args[calls[0].args.indexOf("--sandbox") + 1], "workspace-write");
  assert.ok(calls[0]?.args.includes("sandbox_workspace_write.network_access=true"));
  assert.ok(calls[0]?.args.includes("features.network_proxy.enabled=true"));
  assert.ok(
    calls[0]?.args.includes('features.network_proxy.domains={ "127.0.0.1" = "allow", "localhost" = "allow" }'),
  );
  assert.deepEqual(events, [{ type: "text", content: "ok" }, { type: "done" }]);
});

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

function makeRunInput(): AgentRunInput {
  return {
    agent: {
      id: "agent-a",
      displayName: "架构师",
      mentionHandles: ["@agent-a"],
      provider: "codex",
      model: "gpt-5",
      rolePrompt: "你负责系统架构设计。",
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
