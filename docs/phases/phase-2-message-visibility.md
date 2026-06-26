# Phase 2：Message 可见性模型

## 目标

把当前单一公开 thread 模型升级为支持可控可见性的 message 模型。

Phase 2 的目标不是让 Agent 私聊，而是建立底层消息语义：

- public / private
- visible recipients
- reveal
- origin
- delivery lifecycle
- handoffPayload
- invocation event log

## 核心原则

1. Thread 仍是真相源。
2. private message 仍然写入 thread，只是不同 viewer 看到的上下文不同。
3. 用户拥有全量审计权。
4. Agent 可见内容必须由统一策略判断。
5. CLI 实时事件不默认成为协作事实。

## 数据模型

建议扩展 `Message`：

```ts
export type MessageVisibility = "public" | "private";

export type MessageOrigin =
  | "user"
  | "agent_final"
  | "agent_stream"
  | "callback"
  | "tool"
  | "system"
  | "briefing";

export type Message = {
  id: string;
  threadId: string;
  senderType: "user" | "agent" | "system";
  senderId: string | null;
  content: string;
  mentions: string[];
  createdAt: number;

  visibility?: MessageVisibility;
  visibleToAgentIds?: string[];
  revealedAt?: number;

  origin?: MessageOrigin;
  replyTo?: string;
  invocationId?: string;
  deliveryStatus?: "queued" | "delivered" | "canceled";
  handoffPayload?: HandoffPayload;
};
```

建议新增 `HandoffPayload`：

```ts
export type HandoffPayload = {
  fromAgentId: string;
  toAgentIds: string[];
  triggerMessageId?: string;
  what: string;
  why: string;
  tradeoff: string;
  openQuestions: string[];
  nextAction: string;
  evidenceRefs?: Array<{
    kind: "message" | "file" | "command" | "url" | "other";
    ref: string;
    note?: string;
  }>;
  riskLevel?: "low" | "medium" | "high";
  createdAt: number;
};
```

## Cat Cafe 对照

| Cat Cafe | TheTower |
| --- | --- |
| `visibility='public'` | `visibility='public'` |
| `visibility='whisper'` | `visibility='private'` |
| `whisperTo` | `visibleToAgentIds` |
| `revealedAt` | `revealedAt` |
| `origin='stream'` | `origin='agent_stream'` |
| `origin='callback'` | `origin='callback'` |
| `origin='briefing'` | `origin='briefing'` |

TheTower 增强点：

- 增加 `agent_final` 区分最终回复。
- 增加 `tool` 区分工具事件。
- 增加 `handoffPayload`，让五件套不污染 UI。

## CLI 实时事件处理

CLI JSON 事件解析分三层：

```text
CLI raw event
  只用于解析。

RunEvent / ScreenEvent
  用于 UI 实时展示和 invocation event log。

Message
  经过确认后写入 thread 的协作事实。
```

默认规则：

- token delta 不写入 thread。
- tool call event 默认不进入普通 Agent 上下文。
- final response 写为 `origin='agent_final'`。
- callback 写回写为 `origin='callback'`。
- hidden handoff payload 作为 message 字段，只注入目标 Agent。

## 主要文件

- `packages/shared/src/index.ts`
- `packages/api/src/stores/MessageStore.ts`
- `packages/api/src/db/schema.ts`
- `packages/api/src/services/CommunicationService.ts`
- `packages/api/src/routes.ts`
- `packages/api/src/events/EventBus.ts`
- `packages/web/src/**`

## 开发任务

1. 扩展 shared `Message` 类型。
2. 更新 sqlite schema。
3. 更新 `MessageStore` 序列化 / 反序列化。
4. 现有消息默认兼容：
   - `visibility` 缺省视为 `public`
   - `origin` 缺省按来源推断
   - `deliveryStatus` 缺省视为 `delivered`
5. 新增 `HandoffPayload` 类型。
6. 增加 invocation event log，用于 CLI 实时事件。
7. UI 显示 message origin / visibility badge。
8. UI 为 private message 预留折叠和 reveal 能力。

## 验收标准

- public 消息所有 Agent 可见。
- private 消息只对指定 Agent 可见。
- 用户视角仍可审计全部消息。
- revealed private 消息恢复为全员可见。
- CLI token delta 不会默认触发 A2A 路由。
- `handoffPayload` 不会直接渲染到默认用户 timeline。

## 测试建议

单元测试：

- MessageStore round-trip：
  - `visibility`
  - `visibleToAgentIds`
  - `revealedAt`
  - `origin`
  - `deliveryStatus`
  - `handoffPayload`

回归测试：

- 老消息没有新增字段时仍能读取。
- 旧 API 不传 visibility 时仍写 public。

## 不做事项

- 不开放 callback private。
- 不实现完整 ContextBuilder 替换。
- 不做游戏上下文。
- 不做长期记忆。
