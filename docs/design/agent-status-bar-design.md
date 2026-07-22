# Agent 状态栏设计方案

> 文档状态：Superseded（已实施的历史 UI/Runtime 方案）
> 当前来源：[当前项目架构](../architecture/current-project-architecture.md)、[前端页面说明](../frontend/frontend-pages-guide.md)
> 保留目的：记录 runtime status UI 的设计过程，不代表当前事件模型或前端目录结构。

## 目标

在 TheTower 调试前端中增加 Agent 状态栏，实时显示每个 Agent 的工作状态，并展示当前 session 的 token 消耗与剩余预算。

状态栏必须使用实际 Agent 名称，例如 `Zavala 思考中`、`Banshee 工具调用`，而不是显示泛称 `agent`。

## 猫咖参考结论

参考项目：`/Users/xuchenyang/ai/clowder-ai`

相关实现：

- `packages/web/src/components/ParallelStatusBar.tsx`
- `packages/web/src/components/ThreadCatStatus.tsx`
- `packages/web/src/components/status-helpers.ts`
- `packages/web/src/stores/chat-types.ts`
- `packages/web/src/stores/chatStore.ts`
- `packages/web/src/hooks/useAgentMessages.ts`
- `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts`

猫咖的设计不是把状态栏做成独立逻辑，而是采用“运行时事件 -> thread-scoped store -> 状态栏投影”的结构：

1. 后端在 Agent invocation 生命周期里产生事件。
2. 前端消息处理器消费 `invocation_metrics`、`invocation_usage`、`liveness_warning`、tool progress 等系统事件。
3. 前端 store 维护每个 thread 的 `catStatuses`、`catInvocations`、`activeInvocations`。
4. 状态栏组件只读取 store，按当前 thread 聚合展示活跃 Agent、状态点、运行时长、token usage。

这个模式值得 TheTower 复用，但 TheTower 可以比猫咖更直接：当前项目已经有 SSE `EventBus`，可以直接新增结构化 SSE runtime event，不需要把状态塞进内部 system message 再由前端解析 JSON。

## TheTower 当前基础

当前项目已有可复用基础：

- 后端 SSE：`packages/api/src/routes.ts` 的 `GET /api/events`
- 事件总线：`packages/api/src/events/EventBus.ts`
- Agent 调度：`packages/api/src/services/CommunicationService.ts`
- Agent runner 事件：`AgentEvent`
- 前端 SSE 订阅：`packages/web/src/App.tsx`
- Agent 列表：`Agent.displayName`
- invocation 列表：`Invocation`
- workspace file tool 审计事件：`workspace.file_tool`

当前缺口：

- `AgentEvent` 只有 `text`、`tool_call`、`error`、`done`，无法表达“当前状态”。
- Codex runner 目前只拿最终消息，不能精确流式区分 reasoning/token。
- 前端只有事件日志，没有 per-Agent runtime status store。
- token usage 尚未进入共享类型和 SSE。

## 状态定义

TheTower 状态栏使用四个用户可见状态：

| 状态 | 含义 | 触发来源 |
| --- | --- | --- |
| `thinking` | Agent 正在思考，包含 Claude extended thinking / Codex reasoning 阶段 | runner 启动后，尚未输出文本或工具调用；未来 provider 原生 thinking event |
| `tool_calling` | Agent 正在使用工具，例如读文件、执行命令、搜索代码 | `AgentEvent.tool_call`、MCP file/shell tool、workspace file tool |
| `replying` | Agent 正在输出回复 | `AgentEvent.text` 或未来 streaming delta |
| `idle` | Agent 等待召唤 | invocation 结束、Agent 完成、失败、取消、跳过 |

建议共享类型：

```ts
export type AgentWorkStatus = "idle" | "thinking" | "tool_calling" | "replying";

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

export interface AgentRuntimeStatus {
  agentId: string;
  threadId?: string;
  invocationId?: string;
  status: AgentWorkStatus;
  detail?: string;
  currentToolName?: string;
  tokenUsage?: AgentTokenUsage;
  startedAt?: number;
  updatedAt: number;
}
```

`displayName` 不需要写进 runtime status，前端用 `agentId` 从 `agents` 列表映射，避免状态事件和 Agent 配置重复。

## SSE 事件设计

扩展 `EventBus` 的事件 union：

```ts
type AgentStatusEvent = {
  type: "agent.status";
  threadId: string;
  invocationId: string;
  agentId: string;
  status: "idle" | "thinking" | "tool_calling" | "replying";
  detail?: string;
  toolName?: string;
  createdAt: number;
};

type AgentTokenUsageEvent = {
  type: "agent.token_usage";
  threadId: string;
  invocationId: string;
  agentId: string;
  usage: AgentTokenUsage;
  createdAt: number;
};
```

保留现有 `agent.event` 作为低层审计事件；新增 `agent.status` 作为 UI 当前态的权威事件。

这样做的原因：

- `agent.event` 是瞬时事件，适合日志。
- 状态栏需要当前态，应该有直接状态事件。
- 前端不需要从多种事件里猜测复杂状态。

## 后端状态流转

在 `CommunicationService.executeWorklist` 中，每次开始执行某个 Agent：

```text
agent.status(thinking)
```

处理 runner event 时：

```text
tool_call -> agent.status(tool_calling, toolName)
text      -> agent.status(replying)
error     -> agent.status(idle)
done      -> agent.status(idle)
```

invocation 终止时：

```text
finishInvocation(done|failed|cancelled) -> 当前 invocation 涉及的 Agent 全部 idle
```

Agent 不可用或被跳过：

```text
agent.status(idle, detail="skipped")
```

推荐新增一个私有方法集中发布状态：

```ts
private publishAgentStatus(input: {
  threadId: string;
  invocationId: string;
  agentId: string;
  status: AgentWorkStatus;
  detail?: string;
  toolName?: string;
}): void
```

## Token usage 设计

第一版按能力分层：

1. Provider 能返回 usage：发 `agent.token_usage`，`source = "provider"`。
2. Provider 暂时不能返回 usage：发 `source = "unavailable"` 或不发 usage。
3. 不建议用字符数伪装真实 token。估算值只能标记 `source = "estimated"`，UI 必须显式弱化。

预算字段：

- `budgetTokens`：当前 session 上限。
- `totalTokens`：已消耗总量。
- `remainingTokens = budgetTokens - totalTokens`。

session 预算来源建议：

- MVP：从 Agent model 的默认 context window 或环境配置读取，无法确定则显示 `--`。
- 后续：在 invocation 创建时固化 `tokenBudget`，避免模型配置变动影响历史显示。

显示格式：

```text
Token 12.4k / 80k
剩余 67.6k
```

如果 unavailable：

```text
Token --
```

## 前端状态 store

TheTower 当前前端是单文件 `App.tsx`，不需要一开始引入 Zustand。建议先在 `App` 内维护轻量状态：

```ts
type AgentRuntimeStatusMap = Record<string, AgentRuntimeStatus>;

const [agentRuntimeStatuses, setAgentRuntimeStatuses] =
  useState<AgentRuntimeStatusMap>({});
```

收到 `agent.status`：

```ts
setAgentRuntimeStatuses((prev) => ({
  ...prev,
  [event.agentId]: {
    ...prev[event.agentId],
    agentId: event.agentId,
    threadId: event.threadId,
    invocationId: event.invocationId,
    status: event.status,
    detail: event.detail,
    currentToolName: event.toolName,
    updatedAt: event.createdAt,
  },
}));
```

收到 `agent.token_usage`：

```ts
setAgentRuntimeStatuses((prev) => ({
  ...prev,
  [event.agentId]: {
    ...prev[event.agentId],
    agentId: event.agentId,
    threadId: event.threadId,
    invocationId: event.invocationId,
    status: prev[event.agentId]?.status ?? "idle",
    tokenUsage: event.usage,
    updatedAt: event.createdAt,
  },
}));
```

后续如果前端拆 store，再迁移为猫咖式 thread-scoped store：

```ts
threadRuntime: Record<
  threadId,
  {
    agentStatuses: Record<agentId, AgentRuntimeStatus>;
    activeInvocations: Record<invocationId, { agentId: string; startedAt: number }>;
  }
>
```

## 状态栏组件设计

新增组件：

```text
packages/web/src/AgentStatusBar.tsx
```

Props：

```ts
interface AgentStatusBarProps {
  agents: Agent[];
  statuses: Record<string, AgentRuntimeStatus>;
  selectedThreadId?: string;
}
```

展示规则：

1. 默认展示所有 enabled Agent。
2. 当前 thread 有活跃 invocation 时，把活跃 Agent 排在前面。
3. 非当前 thread 的状态默认不高亮；可以显示为弱化，或 MVP 先只显示 `selectedThreadId` 匹配的状态。
4. Agent 名称用 `agent.displayName`。
5. `tool_calling` 显示工具名，例如 `读文件`、`shell_exec`、`read_file`。
6. token usage 显示在每个 Agent 卡片右侧或第二行。

建议 UI：

```text
Zavala  ● 思考中       Token --
Banshee ● 工具调用     read_file · Token 4.1k / 80k
Ikora   ✓ 回复中       Token 12.4k / 80k · 剩余 67.6k
Cayde   ○ 空闲         Token --
```

视觉映射：

| 状态 | 点/图标 | 颜色 | 动效 |
| --- | --- | --- | --- |
| thinking | 圆点 | 蓝色 | pulse |
| tool_calling | 圆点 | 琥珀色 | pulse |
| replying | 圆点 | 绿色 | pulse |
| idle | 空心圆 | 灰色 | 无 |

布局建议：

- 放在主界面顶部，位于 thread 列表/消息区上方。
- 高度保持紧凑，避免挤压聊天内容。
- 每个 Agent 是一枚 pill，不要做大卡片。
- 移动端横向滚动。

## 工具调用状态来源

第一版可覆盖：

- runner 发出的 `AgentEvent.tool_call`
- `WorkspaceFileService` 的 `workspace.file_tool`
- MCP shell/file tools 如果能识别当前 `agentId`，也发布 `agent.status(tool_calling)`

工具名规范化建议：

```ts
function formatToolName(toolName: string): string {
  if (toolName === "read_file") return "读文件";
  if (toolName === "read_file_slice") return "读文件片段";
  if (toolName === "list_files") return "列文件";
  if (toolName === "write_file") return "写文件";
  if (toolName === "shell_exec") return "执行命令";
  return toolName;
}
```

## Provider 精度策略

### Codex

当前 `CodexCliRunner` 只读取 `codex exec` 最终消息，因此 MVP 精度：

- 子进程启动：`thinking`
- MCP/file/shell 工具调用：`tool_calling`
- 最终消息返回：`replying`
- 写入完成：`idle`
- token：`unavailable`

后续增强：

- 解析 Codex JSONL / stream 输出。
- 抽取 reasoning、tool call、assistant delta、usage。
- 将 reasoning event 映射为 `thinking`，assistant delta 映射为 `replying`。

### Claude

如果 Claude runner 能拿到 extended thinking block：

- thinking block delta：`thinking`
- tool_use：`tool_calling`
- text delta：`replying`
- usage：`agent.token_usage(source="provider")`

如果暂时拿不到 thinking block，使用 runner 启动后的默认 `thinking` 作为近似状态。

## 与猫咖设计的取舍

保留：

- thread-scoped runtime state 的思想。
- 状态栏只做投影，不承担业务推断。
- invocation started/complete 和 usage 分离。
- 活跃 Agent 优先展示。
- token usage 汇总显示。

简化：

- 不通过 system_info JSON 消息承载状态，直接走 SSE。
- 不引入 `alive_but_silent`、`suspected_stall` 等高级 liveness 状态，留作后续。
- 不在 MVP 做费用 cost USD，先做 token。
- 不做复杂 session chain / context health 显示。

## API 与类型改动清单

### shared

文件：`packages/shared/src/index.ts`

新增：

- `AgentWorkStatus`
- `AgentTokenUsage`
- `AgentRuntimeStatus`
- `AgentStatusEvent`
- `AgentTokenUsageEvent`

扩展：

- `AgentEvent` 增加 `thinking`、`token_usage` 可选事件，或保持 runner 内部事件最小化，直接由 `CommunicationService` 发布 status。

推荐第一版只新增 SSE event 类型，不强制所有 runner 支持新 `AgentEvent`。

### api

文件：`packages/api/src/events/EventBus.ts`

新增事件 union：

- `agent.status`
- `agent.token_usage`

文件：`packages/api/src/services/CommunicationService.ts`

新增：

- `publishAgentStatus`
- `publishAgentTokenUsage`
- worklist 启动/结束状态发布
- `handleAgentEvent` 中的状态转换

文件：`packages/api/src/services/WorkspaceFileService.ts`

增强：

- `workspace.file_tool` 事件触发时，如果有 `agentId`，同步发 `agent.status(tool_calling)`。

### web

新增：

- `packages/web/src/AgentStatusBar.tsx`

修改：

- `packages/web/src/App.tsx`
  - 扩展 `ServerEvent`
  - 增加 `agentRuntimeStatuses` state
  - SSE handler 合并 runtime status
  - 在主布局中插入 `AgentStatusBar`

## MVP 验收标准

1. 页面顶部能看到所有 enabled Agent 的实际名称。
2. 用户发送 `@agent-a ...` 后，`agent-a` 立即显示 `思考中`。
3. Agent 产生 tool call 或文件工具事件时，状态变为 `工具调用`，并显示工具名。
4. Agent 返回文本时，状态变为 `回复中`。
5. invocation 完成后，相关 Agent 回到 `空闲`。
6. token usage 可用时显示 `已用 / 预算 / 剩余`。
7. token usage 不可用时显示 `Token --`，不伪造数值。
8. SSE 断开重连后，UI 不崩溃；状态可退回空闲或等待新事件刷新。

## 后续增强

1. 增加 `GET /api/agents/status`，页面刷新后恢复内存状态。
2. 增加 liveness 状态：静默但存活、疑似卡住、超时诊断。
3. 增加 session 级 token budget 配置。
4. 解析 Codex / Claude 原生流式事件，提升 thinking 和 usage 精度。
5. 将前端 runtime status 从 `App.tsx` 抽到独立 store。
6. 增加 route-level token 汇总，用于 fanout / serial 多 Agent 会话总预算展示。
