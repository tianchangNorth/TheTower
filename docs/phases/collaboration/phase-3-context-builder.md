# Phase 3：ContextBuilder 统一上下文入口

## 目标

让所有 Agent 读取上下文时都经过同一个入口，避免 runner、callback、reply preview、未来 search 各自手写过滤逻辑。

Phase 3 是可见性模型真正生效的阶段。

## 核心原则

1. `VisibilityPolicy` 是可见性判断的单一入口。
2. `ContextBuilder` 是 Agent 上下文构造的单一入口。
3. runner 初始 prompt 与 callback `thread-context` 返回结果必须一致。
4. reply preview 必须使用同一套可见性规则，防止引用泄漏。

## ContextViewer

```ts
export type ContextViewer =
  | { type: "user" }
  | { type: "agent"; agentId: string };
```

## VisibilityPolicy

建议提供纯函数：

```ts
export function canViewMessage(message: Message, viewer: ContextViewer): boolean {
  if (viewer.type === "user") return true;

  if (!message.visibility || message.visibility === "public") return true;

  if (message.visibility === "private") {
    if (message.revealedAt) return true;
    return message.visibleToAgentIds?.includes(viewer.agentId) ?? false;
  }

  return false;
}
```

并增加更高层的上下文过滤函数：

```ts
export function canIncludeInAgentContext(input: {
  message: Message;
  viewer: { type: "agent"; agentId: string };
  mode: "debug" | "play";
}): boolean;
```

## ContextBuilder

建议接口：

```ts
export type BuildAgentContextInput = {
  threadId: string;
  agentId: string;
  mode: "debug" | "play";
  limit?: number;
  invocationId?: string;
};

export type AgentContext = {
  threadId: string;
  agentId: string;
  mode: "debug" | "play";
  messages: Message[];
  activeSkills: ResolvedSkill[];
  availableAgents: Agent[];
};
```

## debug / play 规则

debug：

- 尽量保持当前开发体验。
- 用户可见消息基本都可进入上下文。
- 可包含其他 Agent 的 `agent_stream`。
- 可包含 revealed private。
- 仍应排除 `deliveryStatus='canceled'`。
- `briefing` 默认不进入普通上下文，除非显式注入。

play：

- public 可见。
- private 仅 recipient 可见。
- revealed private 可见。
- 隐藏其他 Agent 的 `agent_stream`。
- 隐藏 `briefing`，除非 briefing 明确发给当前 Agent。
- 排除 queued / canceled。

## reply preview 防泄漏

必须禁止：

- public reply 引用 unrevealed private。
- reply 引用 briefing。
- play 模式下引用其他 Agent hidden stream。
- reply 引用 canceled / queued message。

建议实现一个原子函数，不允许调用方自己 `getById` 后手动判断：

```ts
resolveVisibleReplyParent({
  messageId,
  threadId,
  viewer,
  mode,
  publicReply,
});
```

## 主要文件

- `packages/api/src/context/VisibilityPolicy.ts`
- `packages/api/src/context/ContextBuilder.ts`
- `packages/api/src/services/CommunicationService.ts`
- `packages/api/src/routes.ts`
- `packages/api/src/stores/MessageStore.ts`
- `packages/api/src/bootstrap.ts`
- `packages/api/test/**`

## 开发任务

1. 新增 `VisibilityPolicy`。
2. 新增 `ContextBuilder`。
3. `CommunicationService.executeWorklist` 改用 `ContextBuilder` 构造 runner input。
4. `getThreadContextForCallback` 改用 `ContextBuilder`。
5. `replyTo` / preview 解析改用统一可见性校验。
6. Thread 增加 `mode=debug|play`。
7. API 支持读取 / 修改 thread mode。
8. 测试覆盖 debug / play 差异。

## 验收标准

- runner 初始上下文与 callback `thread-context` 使用同一套构建逻辑。
- debug 模式下保持当前调试体验。
- play 模式下隐藏其他 Agent private 和 stream。
- private message 不会被非 recipient Agent 通过 thread-context 读取。
- public reply 不会泄漏 private / briefing / hidden stream。
- `handoffPayload` 只注入给目标 Agent。

## 测试建议

新增测试：

- `VisibilityPolicy.test.ts`
- `ContextBuilder.test.ts`
- callback `thread-context` visibility test
- reply parent eligibility test

关键场景：

```text
Agent A 发 private 给 Agent B。
Agent B 能看到。
Agent C 看不到。
User 能审计。
reveal 后 Agent C 能看到。
```

## 不做事项

- 不开放 MCP private write。
- 不做 UI 大改。
- 不做复杂记忆检索。
