# Agent Runtime Status：一步到位阶段方案

来源总方案：[Agent 状态栏设计方案](../../design/agent-status-bar-design.md)

## 背景

TheTower 当前已有 SSE、Agent runner、invocation、worklist、workspace file tool 审计等基础能力，但缺少一个权威的 Agent runtime status 层。

如果只做 UI MVP，前端会被迫从 `agent.event`、`invocation.updated`、`workspace.file_tool` 等瞬时事件里推断“当前状态”。这会带来三个问题：

1. 刷新页面或 SSE 重连后无法恢复状态。
2. `thinking`、`tool_calling`、`replying`、`idle` 的状态边界会散落在前端。
3. 后续接入 token usage、liveness、provider 原生 stream 后需要推翻旧实现。

本阶段方案直接建设完整 runtime status 系统：后端维护当前状态快照，SSE 发布结构化状态事件，前端只做投影展示。

## Cat Cafe 参考结论

参考项目：`/Users/xuchenyang/ai/clowder-ai`

关键参考文件：

- `packages/web/src/components/ParallelStatusBar.tsx`
- `packages/web/src/components/ThreadCatStatus.tsx`
- `packages/web/src/components/status-helpers.ts`
- `packages/web/src/stores/chat-types.ts`
- `packages/web/src/stores/chatStore.ts`
- `packages/web/src/hooks/useAgentMessages.ts`
- `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts`

可复用结论：

- 状态栏不直接承载业务逻辑，只读取 runtime state 做投影。
- runtime state 按 thread 维护，包含 per-agent status、invocation identity、startedAt、duration、usage、liveness。
- 后端 invocation 生命周期和 provider/tool 事件是状态真相源。
- token usage 独立于文本消息处理，前端把 usage 合并到当前 Agent invocation 快照。
- liveness 是一等状态，不应被压缩成普通 error。

TheTower 取舍：

- 不沿用 Cat Cafe 的 `system_info` JSON 消息承载状态，直接使用 TheTower 现有 SSE。
- 不把状态推断放在前端 store；后端 registry 是权威状态快照。
- 保留 `agent.event` 做审计日志，新增 `agent.status` / `agent.token_usage` 等事件做 UI 状态同步。

## 目标状态

完成后，TheTower 应满足：

- 前端状态栏始终显示所有 enabled Agent 的实际名称。
- Agent 被调用后立即显示 `思考中`。
- Agent 调用工具时显示 `工具调用` 和工具名。
- Agent 输出文本时显示 `回复中`。
- Agent 完成、失败、取消、跳过后进入明确终态，再按规则回到 `空闲`。
- 当前 session token 消耗、预算和剩余预算可见。
- token usage 不可用时显示 `Token --`，不伪造数据。
- 页面刷新或 SSE 重连后可以从 API 恢复当前状态。
- 长时间无事件时可以显示 `静默运行` / `疑似卡住`。
- Codex / Claude 后续接入原生 stream 后无需重构前端状态栏。

## 核心状态模型

### AgentWorkStatus

```ts
export type AgentWorkStatus =
  | "idle"
  | "thinking"
  | "tool_calling"
  | "replying"
  | "alive_but_silent"
  | "suspected_stall"
  | "done"
  | "error";
```

语义：

| 状态 | 用户文案 | 含义 |
| --- | --- | --- |
| `idle` | 空闲 | Agent 等待召唤 |
| `thinking` | 思考中 | runner 已启动，模型正在推理或尚未输出文本/工具事件 |
| `tool_calling` | 工具调用 | Agent 正在使用文件、shell、callback、搜索等工具 |
| `replying` | 回复中 | Agent 正在输出用户可见回复 |
| `alive_but_silent` | 静默运行 | 进程存活，但超过阈值没有新事件 |
| `suspected_stall` | 疑似卡住 | 静默时间过长，需要用户关注 |
| `done` | 完成 | invocation 正常结束后的短暂终态 |
| `error` | 异常 | runner 或 invocation 失败后的终态 |

### AgentRuntimeStatus

```ts
export interface AgentRuntimeStatus {
  agentId: string;
  threadId?: string;
  invocationId?: string;
  status: AgentWorkStatus;
  detail?: string;
  currentToolName?: string;
  startedAt?: number;
  lastEventAt?: number;
  lastToolAt?: number;
  lastTextAt?: number;
  updatedAt: number;
  tokenUsage?: AgentTokenUsage;
  liveness?: AgentLivenessSnapshot;
}
```

`displayName` 不写入 runtime status。前端通过 `agentId` 从 `Agent.displayName` 映射，避免配置和运行态重复。

### AgentTokenUsage

```ts
export interface AgentTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  totalTokens?: number;
  budgetTokens?: number;
  remainingTokens?: number;
  source: "provider" | "estimated" | "unavailable";
}
```

规则：

- Provider 返回真实 usage 时使用 `source = "provider"`。
- 估算值必须使用 `source = "estimated"`，UI 要弱化展示。
- 无法获得 usage 时使用 `source = "unavailable"` 或不发送 token usage。
- 禁止用字符数伪装真实 token。

### AgentLivenessSnapshot

```ts
export interface AgentLivenessSnapshot {
  state: "active" | "busy_silent" | "idle_silent" | "dead";
  silenceDurationMs: number;
  processAlive?: boolean;
  lastEventType?: string;
  checkedAt: number;
}
```

## SSE 事件契约

新增事件：

```ts
export type AgentRuntimeServerEvent =
  | {
      type: "agent.status";
      threadId: string;
      invocationId: string;
      agentId: string;
      status: AgentRuntimeStatus;
      createdAt: number;
    }
  | {
      type: "agent.token_usage";
      threadId: string;
      invocationId: string;
      agentId: string;
      status: AgentRuntimeStatus;
      createdAt: number;
    }
  | {
      type: "agent.liveness";
      threadId: string;
      invocationId: string;
      agentId: string;
      status: AgentRuntimeStatus;
      createdAt: number;
    };
```

事件携带完整 `AgentRuntimeStatus` snapshot，而不是只传 patch。这样前端应用事件时是覆盖式合并，避免漏字段和乱序事件导致脏状态。

保留现有事件：

- `agent.event`：低层审计，记录 text/tool/error/done 等瞬时事件。
- `workspace.file_tool`：文件工具审计。
- `invocation.updated`：invocation 生命周期审计。

## 后端组件

### AgentRuntimeStatusRegistry

新增文件建议：

```text
packages/api/src/agents/AgentRuntimeStatusRegistry.ts
```

职责：

- 维护每个 Agent 当前 runtime status。
- 支持按 thread 查询状态。
- 统一合并 status、token usage、liveness。
- 每次更新后返回完整 snapshot，由上层发布 SSE。

接口：

```ts
export class AgentRuntimeStatusRegistry {
  markSessionStarted(input): AgentRuntimeStatus;
  setStatus(input): AgentRuntimeStatus;
  setTokenUsage(input): AgentRuntimeStatus;
  setLiveness(input): AgentRuntimeStatus;
  markSessionCompleted(input): AgentRuntimeStatus;
  clearInvocation(invocationId: string): AgentRuntimeStatus[];
  list(): AgentRuntimeStatus[];
  listByThread(threadId: string): AgentRuntimeStatus[];
  get(agentId: string): AgentRuntimeStatus | undefined;
}
```

接入：

- 在 `createAppContext()` 中创建。
- 注入 `CommunicationService`。
- 注入 `WorkspaceFileService`。
- 暴露给 routes。

### API 查询

新增接口：

```http
GET /api/agents/runtime-status
GET /api/threads/:threadId/agent-status
```

响应：

```ts
export interface AgentRuntimeStatusResponse {
  statuses: AgentRuntimeStatus[];
}
```

用途：

- 页面初次加载 hydrate。
- SSE 重连后恢复权威状态。
- 调试面板直接查看 runtime 状态。

## 后端状态流转

### CommunicationService

在 `executeWorklist()` 中：

1. Agent 开始执行：

```text
markSessionStarted
agent.status(thinking)
```

2. runner 事件：

```text
thinking    -> thinking
tool_call   -> tool_calling + currentToolName
text        -> replying
token_usage -> agent.token_usage
error       -> error
done        -> done
```

3. Agent 完成后：

```text
done 短暂保留
之后可由下一次 invocation 覆盖，或在 clearInvocation 时回 idle
```

4. invocation 失败或取消：

```text
failed/cancelled -> 当前 invocation 涉及 Agent 标记 error 或 idle(detail="cancelled")
```

5. Agent 不可用或跳过：

```text
idle(detail="skipped")
```

建议新增 helper：

```ts
private publishRuntimeStatus(status: AgentRuntimeStatus): void
private publishAgentStatus(input): void
private publishAgentTokenUsage(input): void
```

### Tool services

需要接入 `tool_calling` 的来源：

- `AgentEvent.tool_call`
- `WorkspaceFileService`
- MCP callback tools
- MCP file tools
- MCP shell tools
- 后续代码搜索 / web search / repo search 工具

工具调用状态规则：

```text
工具开始或审计事件产生 -> tool_calling(toolName)
工具结束后不主动回 thinking
下一个 runner event 决定状态
长时间无后续事件由 liveness 层处理
```

### Provider runner

`AgentEvent` 建议扩展：

```ts
export type AgentEvent =
  | { type: "thinking" }
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "token_usage"; usage: AgentTokenUsage }
  | { type: "error"; error: string }
  | { type: "done" };
```

Codex 当前只能做到：

- runner 启动：`thinking`
- MCP/file/shell 工具：`tool_calling`
- 最终消息返回：`replying`
- 结束：`done`
- token usage：`unavailable`

后续增强：

- `CodexCliRunner` 解析 JSONL / stream 输出。
- Claude runner 解析 extended thinking / tool_use / text delta / usage。
- provider 原生 usage 进入 `agent.token_usage(source="provider")`。

## Token Budget 系统

### 预算来源

优先级：

1. invocation 创建时显式传入 `tokenBudget`。
2. Agent/model 配置中的 context window。
3. provider/model fallback 表。
4. 环境变量 override。
5. unknown：UI 显示 `Token --`。

建议在 invocation 创建时固化预算：

```ts
Invocation.tokenBudget?: number
```

如果暂不改数据库，可先放在 runtime registry，后续再迁移持久化。

### 聚合口径

需要支持三层聚合：

- per-agent current invocation usage。
- per-thread current active invocation total usage。
- route/worklist total usage。

状态栏优先展示 per-agent：

```text
Zavala 回复中 · Token 12.4k / 80k · 剩余 67.6k
```

右侧可展示 thread total：

```text
本轮合计 38.2k / 240k
```

## Liveness 检测

新增定时检查或 invocation loop 内检查：

```text
active status 超过 60s 无事件 -> alive_but_silent
active status 超过 180s 无事件 -> suspected_stall
进程异常退出 -> error
```

候选字段：

- `startedAt`
- `lastEventAt`
- `lastToolAt`
- `lastTextAt`
- `processAlive`
- `silenceDurationMs`

第一版可以只基于 `lastEventAt`，后续再接进程探测。

## 前端架构

### Runtime store

不要把完整逻辑堆进 `App.tsx`。

新增文件建议：

```text
packages/web/src/runtimeStatus.ts
packages/web/src/statusFormat.ts
packages/web/src/AgentStatusBar.tsx
```

`runtimeStatus.ts`：

```ts
export interface RuntimeStatusState {
  statuses: Record<string, AgentRuntimeStatus>;
  applyEvent(event: ServerEvent): RuntimeStatusState;
  hydrate(statuses: AgentRuntimeStatus[]): RuntimeStatusState;
}
```

`statusFormat.ts`：

- `formatAgentStatusLabel(status)`
- `formatToolName(toolName)`
- `formatTokenCount(value)`
- `formatTokenUsage(usage)`
- `statusTone(status)`

### Hydration

前端启动流程：

1. 拉取 agents / threads / workspaces。
2. 拉取 `/api/agents/runtime-status`。
3. 初始化 runtime status store。
4. SSE 连接后增量应用 `agent.status` / `agent.token_usage` / `agent.liveness`。
5. SSE 重连后重新 hydrate 一次 runtime status。

### AgentStatusBar

组件 props：

```ts
interface AgentStatusBarProps {
  agents: Agent[];
  statuses: Record<string, AgentRuntimeStatus>;
  selectedThreadId?: string;
}
```

展示规则：

- 展示所有 enabled Agent。
- 当前 thread 活跃 Agent 排前。
- 当前 thread 之外的活跃 Agent 弱化显示，或标注 thread。
- idle Agent 保持可见。
- Agent 名称使用 `Agent.displayName`。
- 每个 Agent 是紧凑 pill，不做大卡片。
- 移动端横向滚动。

示例：

```text
Zavala 思考中
Banshee 工具调用 · read_file
Ikora 回复中 · Token 12.4k / 80k
Cayde 静默运行 · 92s
Ada 疑似卡住 · shell_exec
Turing 空闲
```

视觉映射：

| 状态 | 颜色 | 动效 |
| --- | --- | --- |
| `idle` | 灰色 | 无 |
| `thinking` | 蓝色 | pulse |
| `tool_calling` | 琥珀色 | pulse |
| `replying` | 绿色 | pulse |
| `alive_but_silent` | 琥珀色 | pulse |
| `suspected_stall` | 橙色 | pulse |
| `done` | 绿色 | 短暂保留 |
| `error` | 红色 | 无 |

## 开发任务

### 1. 契约与类型

1. 在 `packages/shared/src/index.ts` 增加 runtime status 类型。
2. 在 `packages/api/src/events/EventBus.ts` 扩展 SSE event union。
3. 在 SDK 中增加 runtime status response 类型和 client 方法。

### 2. 后端 registry

1. 新增 `AgentRuntimeStatusRegistry`。
2. 在 `bootstrap.ts` 创建并注入服务。
3. 新增 status query routes。
4. 为 registry 写单元测试。

### 3. 调度埋点

1. `CommunicationService.executeWorklist()` 开始执行 Agent 时发布 `thinking`。
2. `handleAgentEvent()` 处理 `thinking` / `tool_call` / `text` / `token_usage` / `error` / `done`。
3. `finishInvocation()` 清理或终态化相关 Agent。
4. callback / final / stream 保持语义独立，不把状态事件写入 message timeline。

### 4. 工具埋点

1. `WorkspaceFileService` 发布 `tool_calling`。
2. MCP callback/file/shell tools 接入 tool status。
3. 统一工具名格式化输入。
4. 保证 denied tool 也能在 detail 中展示失败原因。

### 5. Token budget

1. 定义 provider/model context window fallback。
2. invocation 创建时计算预算。
3. provider usage 合并进入 registry。
4. UI 展示 used / budget / remaining。
5. unavailable 不显示假数字。

### 6. Liveness

1. registry 记录 last event 时间。
2. 增加 liveness checker。
3. 超时发布 `agent.liveness`。
4. UI 展示静默运行 / 疑似卡住。

### 7. Provider stream

1. Codex runner 增加 JSONL / stream 解析入口。
2. Claude runner 对齐 extended thinking / tool_use / usage。
3. provider 不支持时显式标记 unavailable。
4. 增加 runner 级测试。

### 8. 前端

1. 新增 runtime status reducer/store。
2. 新增 `AgentStatusBar`。
3. `App.tsx` 接入 hydrate 和 SSE event apply。
4. 状态栏插入主界面顶部。
5. 事件日志继续显示低层事件。

### 9. 测试与文档

1. 后端 registry 测试。
2. CommunicationService 状态流转测试。
3. WorkspaceFileService tool status 测试。
4. 前端 reducer 测试。
5. 前端状态栏渲染测试。
6. README / phase 文档更新。

## 验收标准

### 后端

- `GET /api/agents/runtime-status` 返回所有有状态 Agent 的最新快照。
- `GET /api/threads/:threadId/agent-status` 返回该 thread 相关状态。
- Agent 开始运行会发布 `agent.status(thinking)`。
- 工具调用会发布 `agent.status(tool_calling)` 并带工具名。
- 文本输出会发布 `agent.status(replying)`。
- 完成、失败、取消后有明确终态。
- token usage 能被合并到 status snapshot。
- SSE event 包含完整 status snapshot。

### 前端

- 状态栏显示所有 enabled Agent 的实际名称。
- 当前 thread 活跃 Agent 排在前面。
- 状态文案正确显示为思考中、工具调用、回复中、空闲等。
- token usage 可用时显示 used / budget / remaining。
- token unavailable 时显示 `Token --`。
- 刷新页面后能通过 hydrate 恢复状态。
- SSE 重连后不会残留错误状态。

### Provider

- Codex 当前能力下至少能显示 thinking / tool_calling / replying / done。
- Claude extended thinking 接入后能映射为 thinking。
- provider usage 不可用时不生成伪数据。

## 不做事项

- 不把 runtime status 持久化到 SQLite 历史表；当前状态放内存 registry。
- 不把状态事件写进 thread message timeline。
- 不用前端推断复杂生命周期。
- 不把 token 估算伪装成 provider usage。
- 不在本阶段做费用 USD 计算。

## 推荐落地顺序

```text
1. shared 类型与 SSE 契约
2. AgentRuntimeStatusRegistry
3. runtime status query API
4. CommunicationService 生命周期埋点
5. Workspace/MCP tool 埋点
6. 前端 runtime status store
7. AgentStatusBar UI
8. token budget 与 usage 聚合
9. liveness 检测
10. Codex / Claude 原生 stream 精度增强
11. 测试与文档收口
```
