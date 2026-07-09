import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { AgentRegistry } from "../src/agents/AgentRegistry.js";
import { AgentRuntimeStatusRegistry } from "../src/agents/AgentRuntimeStatusRegistry.js";
import { RunnerRegistry } from "../src/agents/RunnerRegistry.js";
import { ContextBuilder } from "../src/context/ContextBuilder.js";
import { initSchema } from "../src/db/schema.js";
import { EventBus } from "../src/events/EventBus.js";
import { WorklistRegistry } from "../src/routing/WorklistRegistry.js";
import { CommunicationService } from "../src/services/CommunicationService.js";
import { CallbackTokenStore } from "../src/stores/CallbackTokenStore.js";
import { InvocationStore } from "../src/stores/InvocationStore.js";
import { MessageStore } from "../src/stores/MessageStore.js";
import { ThreadStore } from "../src/stores/ThreadStore.js";
import { WorkspaceStore } from "../src/stores/WorkspaceStore.js";
import type { ServerEvent } from "../src/events/EventBus.js";
import type { Message } from "../src/types.js";

test("postAgentMessage allows public replyTo messages", async () => {
  const fixture = makeFixture();

  await fixture.communication.postAgentMessage({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "ikora",
    content: "公开引用普通消息。",
    replyTo: "public-parent",
  });

  const messages = fixture.messageStore.listByThread("thread-1");
  const created = messages.find((message) => message.replyTo === "public-parent");
  assert.equal(created?.content, "公开引用普通消息。");
});

test("postAgentMessage rejects replyTo messages that cannot be publicly quoted", async () => {
  const fixture = makeFixture();

  await assert.rejects(
    () =>
      fixture.communication.postAgentMessage({
        invocationId: "invocation-1",
        callbackToken: "token-1",
        agentId: "ikora",
        content: "不应公开引用私密消息。",
        replyTo: "private-parent",
      }),
    /cannot be quoted by a public callback message/,
  );

  const messages = fixture.messageStore.listByThread("thread-1");
  assert.equal(
    messages.some((message) => message.content === "不应公开引用私密消息。"),
    false,
  );
});

test("postAgentMessage stores private callback messages with sender and targets visible", async () => {
  const fixture = makeFixture({ currentAgentId: "zavala", mode: "play" });

  const result = await fixture.communication.postAgentMessage({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "zavala",
    content: "@banshee 已完成300个测试用例",
    visibility: "private",
    visibleToAgentIds: ["banshee"],
  });

  const message = fixture.messageStore.get(result.messageId);
  assert.equal(message?.visibility, "private");
  assert.deepEqual(message?.visibleToAgentIds, ["banshee", "zavala"]);
  assert.deepEqual(message?.mentions, ["banshee"]);
  assert.deepEqual(message?.extra, { isExplicitPost: true });
});

test("postAgentMessage deduplicates exact callback retries without rerouting", async () => {
  const fixture = makeFixture({ currentAgentId: "zavala", routeMode: "serial" });
  const input = {
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "zavala",
    content: "@banshee 请继续。",
  };

  const first = await fixture.communication.postAgentMessage(input);
  const second = await fixture.communication.postAgentMessage(input);

  const agentMessages = fixture.messageStore
    .listByInvocation({ threadId: "thread-1", invocationId: "invocation-1", senderId: "zavala" })
    .filter((message) => message.senderType === "agent");

  assert.equal(second.messageId, first.messageId);
  assert.deepEqual(first.routed, ["banshee"]);
  assert.deepEqual(second.routed, []);
  assert.equal(agentMessages.length, 1);
  assert.deepEqual(fixture.worklists.get("invocation-1")?.list, ["zavala", "banshee"]);
});

test("postAgentMessage does not deduplicate callbacks with different visibility targets", async () => {
  const fixture = makeFixture({ currentAgentId: "zavala", routeMode: "serial" });

  const first = await fixture.communication.postAgentMessage({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "zavala",
    content: "私密状态。",
    visibility: "private",
    visibleToAgentIds: ["banshee"],
  });
  const second = await fixture.communication.postAgentMessage({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "zavala",
    content: "私密状态。",
    visibility: "private",
    visibleToAgentIds: ["ikora"],
  });

  assert.notEqual(second.messageId, first.messageId);
});

test("postAgentMessage does not infer private visibility from root message wording", async () => {
  const fixture = makeFixture({
    currentAgentId: "zavala",
    rootContent: "@指挥官 给班西说一句悄悄话 ‘已完成300个测试用例’",
  });

  const result = await fixture.communication.postAgentMessage({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "zavala",
    content: "已完成300个测试用例",
    targetAgents: ["banshee"],
  });

  const message = fixture.messageStore.get(result.messageId);
  assert.equal(message?.visibility, "public");
  assert.equal(message?.visibleToAgentIds, undefined);
});

test("private callback messages are filtered from non-visible agent callback context in play mode", async () => {
  const fixture = makeFixture({ currentAgentId: "zavala", mode: "play" });

  await fixture.communication.postAgentMessage({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "zavala",
    content: "@banshee 已完成300个测试用例",
    visibility: "private",
    visibleToAgentIds: ["banshee"],
  });
  const entry = fixture.worklists.get("invocation-1");
  assert.ok(entry);
  entry.list.push("ikora");
  entry.currentIndex = entry.list.indexOf("ikora");

  const context = fixture.communication.getThreadContextForCallback({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    threadId: "thread-1",
  });

  assert.equal(
    context.some((message) => message.content.includes("已完成300个测试用例")),
    false,
  );
});

test("postAgentMessage normalizes handoffPayload and routes to handoff targets", async () => {
  const fixture = makeFixture({ currentAgentId: "ikora", mode: "play" });

  const result = await fixture.communication.postAgentMessage({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "ikora",
    content: "@banshee 请根据隐藏交接上下文继续。",
    visibility: "private",
    visibleToAgentIds: ["banshee"],
    handoffPayload: {
      toAgentIds: ["banshee"],
      what: "已完成风格分析。",
      why: "需要进入初稿阶段。",
      tradeoff: "公开消息保持简短。",
      nextAction: "起草文章初稿。",
    },
  });

  const message = fixture.messageStore.get(result.messageId);
  assert.equal(message?.handoffPayload?.fromAgentId, "ikora");
  assert.equal(message?.handoffPayload?.createdAt !== undefined, true);
  assert.deepEqual(message?.handoffPayload?.openQuestions, []);
  assert.deepEqual(result.routed, ["banshee"]);
});

test("callbacks route line-start mentions even when parent invocation is legacy fanout", async () => {
  const fixture = makeFixture({ currentAgentId: "zavala", routeMode: "fanout" });

  const result = await fixture.communication.postAgentMessage({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "zavala",
    content: "@banshee 请接手这个任务。",
  });

  const message = fixture.messageStore.get(result.messageId);
  assert.deepEqual(result.routed, ["banshee"]);
  assert.deepEqual(message?.mentions, ["banshee"]);
  assert.deepEqual(fixture.worklists.get("invocation-1")?.list, ["zavala", "banshee"]);
});

test("fanout callbacks still honor structured targetAgents as explicit routing", async () => {
  const fixture = makeFixture({ currentAgentId: "zavala", routeMode: "fanout" });

  const result = await fixture.communication.postAgentMessage({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "zavala",
    content: "请继续。",
    targetAgents: ["banshee"],
  });

  const message = fixture.messageStore.get(result.messageId);
  assert.deepEqual(result.routed, ["banshee"]);
  assert.deepEqual(message?.mentions, ["banshee"]);
  assert.deepEqual(fixture.worklists.get("invocation-1")?.list, ["zavala", "banshee"]);
});

test("callback routeMode is ignored for line-start mention routing", async () => {
  const fixture = makeFixture({ currentAgentId: "zavala", routeMode: "fanout" });

  const result = await fixture.communication.postAgentMessage({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "zavala",
    content: "@banshee 请接手这个串行子任务。",
    routeMode: "parallel",
  });

  const message = fixture.messageStore.get(result.messageId);
  assert.deepEqual(result.routed, ["banshee"]);
  assert.deepEqual(message?.mentions, ["banshee"]);
});

test("stream text stays in stream bubble while callback routes normally", async () => {
  const fixture = makeFixture({ currentAgentId: "zavala", routeMode: "serial" });
  const content = [
    "这是我的疏忽。",
    "",
    "@banshee 请继续。",
  ].join("\n");

  await fixture.communication.postAgentMessage({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "zavala",
    content,
  });
  await fixture.communication["handleAgentEvent"]("thread-1", "invocation-1", "zavala", {
    type: "stream_text",
    content,
  });

  const agentMessages = fixture.messageStore
    .listByInvocation({ threadId: "thread-1", invocationId: "invocation-1", senderId: "zavala" })
    .filter((message) => message.senderType === "agent");

  assert.deepEqual(agentMessages.map((message) => message.origin), ["callback", "agent_stream"]);
  assert.equal(agentMessages[0]?.extra?.stream, undefined);
  assert.equal(agentMessages[1]?.content, content);
  assert.equal(agentMessages[1]?.extra?.stream?.cliStdout, content);
  // Only callback routed; stream text never pushes the worklist.
  assert.deepEqual(fixture.worklists.get("invocation-1")?.list, ["zavala", "banshee"]);
});

test("stream text with @mention does not route; only callback routes", async () => {
  const fixture = makeFixture({ currentAgentId: "zavala", routeMode: "serial" });

  await fixture.communication["handleAgentEvent"]("thread-1", "invocation-1", "zavala", {
    type: "stream_text",
    content: "@ikora CLI stdout 里的草稿，不应触发路由。",
  });

  const callback = await fixture.communication.postAgentMessage({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "zavala",
    content: "@ikora 请检查这个方案。",
  });

  const entry = fixture.worklists.get("invocation-1");
  const callbackMessage = fixture.messageStore
    .listByInvocation({ threadId: "thread-1", invocationId: "invocation-1", senderId: "zavala" })
    .find((message) => message.origin === "callback");
  const streamMessage = fixture.messageStore
    .listByInvocation({ threadId: "thread-1", invocationId: "invocation-1", senderId: "zavala" })
    .find((message) => message.origin === "agent_stream");
  assert.deepEqual(callbackMessage?.mentions, ["ikora"]);
  assert.equal(callbackMessage?.extra?.stream, undefined);
  assert.equal(streamMessage?.content, "@ikora CLI stdout 里的草稿，不应触发路由。");
  // callback routed ikora once; stream did not add a second route.
  assert.deepEqual(entry?.list, ["zavala", "ikora"]);
  assert.equal(entry?.triggerMessageId["ikora"], callback.messageId);
  assert.equal(entry?.triggerOrigin["ikora"], "callback");
});

test("thinking streams separately from callback without duplicate final CLI output", async () => {
  const fixture = makeFixture({ currentAgentId: "zavala", routeMode: "serial" });

  await fixture.communication["handleAgentEvent"]("thread-1", "invocation-1", "zavala", {
    type: "thinking",
    content: "我在判断",
    mode: "delta",
  });

  await fixture.communication["handleAgentEvent"]("thread-1", "invocation-1", "zavala", {
    type: "thinking",
    content: "是否需要回复公共区。",
    mode: "delta",
  });

  await fixture.communication["handleAgentEvent"]("thread-1", "invocation-1", "zavala", {
    type: "stream_text",
    content: "检查当前状态...",
  });

  await fixture.communication.postAgentMessage({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    agentId: "zavala",
    content: "收到，Guardian。我在。\n\n[Zavala]",
  });

  await fixture.communication["handleAgentEvent"]("thread-1", "invocation-1", "zavala", {
    type: "text",
    content: "收到，Guardian。我在。\n\n[Zavala]",
  });

  const agentMessages = fixture.messageStore
    .listByInvocation({ threadId: "thread-1", invocationId: "invocation-1", senderId: "zavala" })
    .filter((message) => message.senderType === "agent");

  assert.deepEqual(agentMessages.map((message) => message.origin), ["agent_stream", "callback"]);
  const stream = agentMessages.find((message) => message.origin === "agent_stream");
  const callback = agentMessages.find((message) => message.origin === "callback");
  assert.equal(stream?.content, "检查当前状态...");
  assert.equal(stream?.thinking, "我在判断是否需要回复公共区。");
  assert.equal(stream?.extra?.stream?.cliStdout, "检查当前状态...");
  assert.equal(stream?.extra?.stream?.chunks, undefined);
  assert.equal(callback?.content, "收到，Guardian。我在。\n\n[Zavala]");
  assert.equal(callback?.thinking, undefined);
  assert.equal(callback?.extra?.stream, undefined);
});

test("revealMessage makes a private message visible to other agents", () => {
  const fixture = makeFixture({ currentAgentId: "banshee", mode: "play" });

  const revealed = fixture.communication.revealMessage({
    threadId: "thread-1",
    messageId: "private-parent",
  });

  assert.equal(revealed.visibility, "private");
  assert.equal(typeof revealed.revealedAt, "number");

  const context = fixture.communication.getThreadContextForCallback({
    invocationId: "invocation-1",
    callbackToken: "token-1",
    threadId: "thread-1",
  });

  assert.equal(
    context.some((message) => message.id === "private-parent"),
    true,
  );
});

test("revealMessage rejects public messages", () => {
  const fixture = makeFixture();

  assert.throws(
    () =>
      fixture.communication.revealMessage({
        threadId: "thread-1",
        messageId: "public-parent",
      }),
    /only private messages can be revealed/,
  );
});

test("postUserMessage fanout runs each target once without repeated A2A routing", async () => {
  const fixture = makeFixture();
  const events: ServerEvent[] = [];
  fixture.events.subscribe((event) => events.push(event));

  const result = await fixture.communication.postUserMessage({
    threadId: "thread-1",
    content: "请分别做一个简短自我介绍。",
    targetAgents: ["ikora", "banshee"],
    routeMode: "fanout",
  });

  await waitForInvocationStatus(fixture.invocationStore, result.invocationId, "done");

  const invocation = fixture.invocationStore.get(result.invocationId);
  const messages = fixture.messageStore.listByThread("thread-1");
  const agentMessages = messages.filter((message) => message.invocationId === result.invocationId && message.senderType === "agent");

  assert.equal(invocation?.routeMode, "fanout");
  assert.deepEqual(invocation?.targetAgents, ["ikora", "banshee"]);
  assert.deepEqual(
    [...new Set(agentMessages.map((message) => message.senderId ?? ""))].sort(),
    ["banshee", "ikora"],
  );
  assert.equal(agentMessages.every((message) => message.mentions.length === 0), true);
  assert.equal(
    events.some(
      (event) => event.type === "agent.event" && event.invocationId === result.invocationId && event.eventType === "done",
    ),
    true,
  );
  assert.equal(
    events.some(
      (event) => event.type === "invocation.updated" && event.invocationId === result.invocationId && event.status === "done",
    ),
    true,
  );
});

test("postUserMessage serial records routeMode and runs the provided worklist", async () => {
  const fixture = makeFixture();

  const result = await fixture.communication.postUserMessage({
    threadId: "thread-1",
    content: "请串行处理这个任务。",
    targetAgents: ["ikora", "banshee"],
    routeMode: "serial",
  });

  await waitForInvocationStatus(fixture.invocationStore, result.invocationId, "done");

  const invocation = fixture.invocationStore.get(result.invocationId);
  const agentMessages = fixture.messageStore
    .listByThread("thread-1")
    .filter((message) => message.invocationId === result.invocationId && message.senderType === "agent");

  assert.equal(invocation?.routeMode, "serial");
  assert.deepEqual(
    [...new Set(agentMessages.map((message) => message.senderId ?? ""))].sort(),
    ["banshee", "ikora"],
  );
});

test("postUserMessage stores projectPath when creating a new thread", async () => {
  const fixture = makeFixture();

  const result = await fixture.communication.postUserMessage({
    content: "@ikora 使用这个 workspace。",
    projectPath: "/Users/xuchenyang/ai/TheTower",
  });

  await waitForInvocationStatus(fixture.invocationStore, result.invocationId, "done");

  assert.equal(fixture.threadStore.get(result.threadId)?.projectPath, "/Users/xuchenyang/ai/TheTower");
  assert.equal(fixture.workspaceStore.getByProjectPath("/Users/xuchenyang/ai/TheTower")?.name, "TheTower");
});

function makeFixture(
  options: {
    currentAgentId?: string;
    mode?: "debug" | "play";
    rootContent?: string;
    routeMode?: "single" | "serial" | "fanout" | "parallel";
  } = {},
): {
  communication: CommunicationService;
  threadStore: ThreadStore;
  workspaceStore: WorkspaceStore;
  messageStore: MessageStore;
  invocationStore: InvocationStore;
  worklists: WorklistRegistry;
  events: EventBus;
} {
  const currentAgentId = options.currentAgentId ?? "ikora";
  const db = new Database(":memory:");
  initSchema(db);

  const threadStore = new ThreadStore(db);
  const messageStore = new MessageStore(db);
  const invocationStore = new InvocationStore(db);
  const callbackTokenStore = new CallbackTokenStore(db);
  const workspaceStore = new WorkspaceStore(db);
  const worklists = new WorklistRegistry();
  const runtimeStatuses = new AgentRuntimeStatusRegistry();
  const agentRegistry = new AgentRegistry();
  agentRegistry.replaceAll([
    {
      id: "ikora",
      displayName: "Ikora Rey",
      mentionHandles: ["@ikora"],
      provider: "mock",
      model: "mock",
      persona: { roleDescription: "负责深度调研与方案推演。", personality: "冷静缜密", strengths: ["调研"], restrictions: [] },
      enabled: true,
      createdAt: 1,
    },
    {
      id: "zavala",
      displayName: "Commander Zavala",
      mentionHandles: ["@zavala", "@指挥官"],
      provider: "mock",
      model: "mock",
      persona: { roleDescription: "负责接收目标、拆解任务与调度。", personality: "沉稳克制", strengths: ["调度"], restrictions: [] },
      enabled: true,
      createdAt: 2,
    },
    {
      id: "banshee",
      displayName: "Banshee-44",
      mentionHandles: ["@banshee", "@班西"],
      provider: "mock",
      model: "mock",
      persona: { roleDescription: "负责代码实现与接口打磨。", personality: "务实专注", strengths: ["实现"], restrictions: [] },
      enabled: true,
      createdAt: 3,
    },
  ]);

  threadStore.create({
    id: "thread-1",
    title: "Test thread",
    mode: options.mode ?? "debug",
    createdAt: 1,
    updatedAt: 1,
  });
  messageStore.create(makeMessage({ id: "root-message", content: options.rootContent ?? "root" }));
  messageStore.create(makeMessage({ id: "public-parent", content: "public parent" }));
  messageStore.create(
    makeMessage({
      id: "private-parent",
      content: "private parent",
      visibility: "private",
      visibleToAgentIds: ["ikora"],
    }),
  );
  invocationStore.create({
    id: "invocation-1",
    threadId: "thread-1",
    rootMessageId: "root-message",
    status: "running",
    targetAgents: [currentAgentId],
    routeMode: options.routeMode,
    depth: 0,
    createdAt: 1,
  });
  callbackTokenStore.create({
    invocationId: "invocation-1",
    token: "token-1",
    expiresAt: Date.now() + 60_000,
  });
  worklists.register({
    invocationId: "invocation-1",
    threadId: "thread-1",
    targetAgents: [currentAgentId],
    routeMode: options.routeMode,
    maxDepth: 10,
    abortController: new AbortController(),
  });

  const events = new EventBus();
  const communication = new CommunicationService({
    agentRegistry,
    runnerRegistry: new RunnerRegistry(),
    threadStore,
    messageStore,
    invocationStore,
    callbackTokenStore,
    workspaceStore,
    worklists,
    events,
    runtimeStatuses,
    contextBuilder: new ContextBuilder({ messageStore }),
  });

  return { communication, threadStore, workspaceStore, messageStore, invocationStore, worklists, events };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "message-1",
    threadId: "thread-1",
    senderType: "user",
    content: "content",
    mentions: [],
    origin: "user",
    deliveryStatus: "delivered",
    createdAt: 1,
    ...overrides,
  };
}

async function waitForInvocationStatus(
  invocationStore: InvocationStore,
  invocationId: string,
  status: "done" | "failed" | "cancelled",
): Promise<void> {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    if (invocationStore.get(invocationId)?.status === status) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(invocationStore.get(invocationId)?.status, status);
}
