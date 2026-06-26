# Phase 4：Callback 与 MCP 可见性升级

## 目标

在 Message 可见性和 ContextBuilder 稳定后，受控开放 callback / MCP 的 private 写回能力。

Phase 4 的重点是兼容扩展，不是重写 callback。

## 当前接口

现有 MCP 工具：

```text
post_message
  -> POST /api/callbacks/post-message

get_thread_context
  -> GET /api/callbacks/thread-context
```

现有语义：

- `post_message` 默认写公开 thread 消息。
- `get_thread_context` 读取当前 thread 上下文。

这些接口名称保持不变。

## 设计原则

1. 老调用不传 visibility，仍然写 public。
2. `targetAgents` 是路由目标。
3. `visibleToAgentIds` 是可见目标。
4. 两者不能混用。
5. private callback 必须可审计。
6. private callback 不能绕过 ContextBuilder。

## Phase 4 schema

```ts
type PostMessageBody = {
  invocationId: string;
  callbackToken: string;
  agentId: string;
  content: string;

  targetAgents?: string[];

  visibility?: "public" | "private";
  visibleToAgentIds?: string[];

  handoffPayload?: HandoffPayload;
  replyTo?: string;
};
```

## 校验规则

默认：

```text
visibility = public
origin = callback
```

private：

- `visibleToAgentIds`、`targetAgents` 或 `handoffPayload.toAgentIds` 至少提供一种可见/交接目标。
- `visibleToAgentIds` 必须是已启用 Agent。
- 服务端会把当前 Agent 自动加入 `visibleToAgentIds`，保证发送者能在后续上下文中看到自己发出的 private 消息。
- 当前 Agent 可以给明确目标 Agent 发 private。
- 用户始终可审计。

路由：

- `targetAgents` 决定唤醒谁。
- line-start mention 仍可解析路由目标。
- `targetAgents` 与 mention 目标合并去重。
- 当 `visibility=private` 时，`targetAgents` 必须是 `visibleToAgentIds` 的子集，或服务端自动并入 `visibleToAgentIds`。
- private message 不触发非 recipient Agent。

reply：

- public reply 不能引用 unrevealed private。
- private reply 可以引用 sender 可见的 private parent。
- briefing 不能作为普通 reply parent。

## MCP 工具升级

`post_message` input schema 增加：

```ts
visibility?: "public" | "private";
visibleToAgentIds?: string[];
handoffPayload?: HandoffPayload;
```

工具描述必须明确：

```text
默认写回公开 thread 消息。
如需私密上下文，显式使用 visibility=private 和 visibleToAgentIds。
targetAgents 用于路由，不等于可见范围。
```

`get_thread_context` 不需要增加可见性参数，因为服务端通过 invocation / token 识别 caller Agent，并使用 `ContextBuilder` 返回可见上下文。

## Prompt 注入升级

Codex HTTP fallback prompt 和 Claude MCP prompt 都要同步说明：

- callback 默认 public。
- private 是受控能力。
- 不要为了普通 @mention 使用 private。
- 不要把用户应该看到的内容塞进 hidden payload。
- 已通过 callback 写回的内容，最终回复不要重复。

## 主要文件

- `packages/api/src/routes.ts`
- `packages/api/src/services/CommunicationService.ts`
- `packages/mcp-server/src/index.ts`
- `packages/sdk/src/index.ts`
- `packages/api/src/agents/runners/CodexCliRunner.ts`
- `packages/api/src/agents/runners/ClaudeCliRunner.ts`
- `packages/api/test/**`
- `packages/mcp-server/test/**`
- `packages/sdk/test/**`

## 开发任务

1. [x] 扩展 callback post-message schema。
2. [x] 扩展 SDK client。
3. [x] 扩展 MCP `post_message` schema。
4. [x] 增加 private callback 权限校验。
5. [x] 增加 `handoffPayload` callback 写入支持。
6. [x] 更新 Codex HTTP fallback prompt。
7. [x] 更新 Claude MCP 工具说明。
8. [x] 增加 private callback tests。
9. [x] 增加 reveal API 或内部 reveal 方法。
10. [x] 增加用户 UI 审计 private callback 的展示能力。

## 当前实现状态

已完成 Phase 4 的 callback / SDK / MCP / runner prompt 主链路：

- `POST /api/callbacks/post-message` 支持 `visibility`、`visibleToAgentIds`、`handoffPayload`。
- 默认不传 `visibility` 仍写 `public`。
- `visibility=private` 时，服务端校验可见 Agent 必须启用。
- `targetAgents`、line-start mention 和 `handoffPayload.toAgentIds` 会合并为路由目标。
- private 消息会自动把 sender 和路由目标并入 `visibleToAgentIds`。
- 当服务端识别到明确私密传输意图，且 callback 有明确目标时，即使 Agent 忘记传 `visibility=private`，服务端也会兜底按 private 写入。
- callback `thread-context` 继续通过 `ContextBuilder` 返回 caller Agent 可见上下文。
- `debug` 和 `play` 都不会把 private 消息暴露给非可见 Agent；用户审计由 UI / messages API 承担，不通过 Agent context 泄露。
- Claude MCP `post_message` schema 已支持 private / handoff。
- Codex HTTP fallback prompt 已包含 private curl 示例。
- `POST /api/threads/:threadId/messages/:messageId/reveal` 可 reveal private message，reveal 后会设置 `revealedAt` 并进入所有 Agent 可见上下文。
- 前端 timeline 已支持 public / private / callback / private callback / revealed / handoff 审计筛选，并可对 private message 执行 reveal。

## 验收标准

- 老 MCP `post_message({ content })` 仍写 public。
- `post_message({ visibility: "private", visibleToAgentIds: ["ikora"] })` 只对 Ikora 可见。
- private callback 不唤醒非 recipient Agent。
- `targetAgents` 与 `visibleToAgentIds` 边界清晰。
- `get_thread_context` 返回 caller Agent 可见上下文。
- 用户 UI 可审计 private callback。

## 不做事项

- 不做 cross-thread callback private。
- 不做 permission / proposal 完整工具体系。
- 不做长期记忆。
