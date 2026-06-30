import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendEventLog,
  EVENT_LOG_CAP,
  isAgentRuntimeEvent,
  shouldRefreshThreadData,
} from "../src/lib/eventFlow";
import { createEventStream } from "../src/lib/eventStream";
import type { ServerEvent } from "../src/types";

// ---- eventFlow 纯函数 ----

test("appendEventLog 截断到 EVENT_LOG_CAP，新事件在前", () => {
  const event = (id: string): ServerEvent => ({ type: "message.created", threadId: "t1", messageId: id });
  let items = [];
  for (let i = 0; i < EVENT_LOG_CAP + 5; i++) {
    items = appendEventLog(items, event(`m${i}`), i, i);
  }
  assert.equal(items.length, EVENT_LOG_CAP);
  // 最新事件在前
  assert.equal(items[0]?.event.messageId, `m${EVENT_LOG_CAP + 4}`);
});

test("shouldRefreshThreadData 只在事件属于当前 thread 时为真，避免跨 thread 串数据", () => {
  const event: ServerEvent = { type: "message.created", threadId: "t-actual", messageId: "m1" };
  assert.equal(shouldRefreshThreadData(event, "t-actual"), true);
  // 其他 thread 的事件不应触发当前 thread 刷新
  assert.equal(shouldRefreshThreadData(event, "t-other"), false);
  // 未选中 thread 时不刷新
  assert.equal(shouldRefreshThreadData(event, undefined), false);
});

test("isAgentRuntimeEvent 识别 agent 运行时事件", () => {
  const statusEvent = {
    type: "agent.status",
    threadId: "t1",
    invocationId: "i1",
    agentId: "a1",
    status: { agentId: "a1", status: "thinking", updatedAt: 0 },
    createdAt: 0,
  } as ServerEvent;
  const messageEvent: ServerEvent = { type: "message.created", threadId: "t1", messageId: "m1" };
  assert.equal(isAgentRuntimeEvent(statusEvent), true);
  assert.equal(isAgentRuntimeEvent(messageEvent), false);
});

// ---- createEventStream 连接/重连/转发 ----

class FakeEventSource {
  static last: FakeEventSource | null = null;
  readonly url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  closeCount = 0;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.last = this;
  }
  close() {
    this.closeCount += 1;
  }
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
  open() {
    this.onopen?.();
  }
  fail() {
    this.onerror?.();
  }
}

test("createEventStream: 连接 → connected，事件转发解析 JSON", () => {
  const statuses: string[] = [];
  const events: ServerEvent[] = [];
  const controller = createEventStream(
    "/api/events",
    {
      onStatusChange: (s) => statuses.push(s),
      onEvent: (e) => events.push(e),
    },
    FakeEventSource as unknown as typeof EventSource,
  );
  assert.equal(FakeEventSource.last?.url, "/api/events");
  assert.deepEqual(statuses, ["connecting"]);
  FakeEventSource.last?.open();
  assert.equal(statuses.at(-1), "connected");
  FakeEventSource.last?.emit({ type: "message.created", threadId: "t1", messageId: "m1" });
  assert.equal(events.length, 1);
  assert.equal((events[0] as { messageId: string }).messageId, "m1");
  controller.close();
  assert.equal(FakeEventSource.last?.closeCount, 1);
});

test("createEventStream: 断线 → error 并触发 onDisconnect；重连后恢复 connected", () => {
  const statuses: string[] = [];
  let disconnected = 0;
  createEventStream(
    "/api/events",
    {
      onStatusChange: (s) => statuses.push(s),
      onEvent: () => {},
      onDisconnect: () => { disconnected += 1; },
    },
    FakeEventSource as unknown as typeof EventSource,
  );
  const source = FakeEventSource.last!;
  source.open();
  source.fail(); // 断线
  assert.equal(statuses.at(-1), "error");
  assert.equal(disconnected, 1);
  // 浏览器 EventSource 自动重连成功后会再次触发 onopen
  source.open();
  assert.equal(statuses.at(-1), "connected");
});

test("createEventStream: 非 JSON 事件被忽略，不抛错", () => {
  const events: ServerEvent[] = [];
  createEventStream(
    "/api/events",
    { onStatusChange: () => {}, onEvent: (e) => events.push(e) },
    FakeEventSource as unknown as typeof EventSource,
  );
  const source = FakeEventSource.last!;
  assert.doesNotThrow(() => source.onmessage?.({ data: "{not json" }));
  assert.equal(events.length, 0);
});
