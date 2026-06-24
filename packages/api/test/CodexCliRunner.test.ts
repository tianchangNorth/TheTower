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
  assert.match(prompt, /如果需要把任务交给其他 Agent/);
  assert.match(prompt, /sender=user mentions=agent-a/);
  assert.match(prompt, /@agent-a 设计方案/);
});

test("CodexCliRunner invokes codex exec and yields last message output", async () => {
  const calls: Array<{ command: string; args: string[]; stdin: string }> = [];
  const runner = new CodexCliRunner({
    command: "codex-test",
    cwd: "/tmp/the-tower-test",
    sandbox: "read-only",
    approvalPolicy: "never",
    timeoutMs: 1000,
    env: {},
    spawn: (command, args) => {
      const child = new EventEmitter() as any;
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = () => true;
      child.stdin.on("finish", async () => {
        const outputFile = args[args.indexOf("--output-last-message") + 1];
        assert.ok(outputFile);
        await writeFile(outputFile, "Codex final answer");
        calls.push({ command, args, stdin: child.stdin.read()?.toString("utf8") ?? "" });
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
  assert.deepEqual(events, [{ type: "text", content: "Codex final answer" }, { type: "done" }]);
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
