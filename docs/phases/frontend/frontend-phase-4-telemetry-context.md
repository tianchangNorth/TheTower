# Frontend Phase 4：Telemetry 与 Thread Context

> 文档状态：Superseded（历史 Phase 记录）
> 当前来源：[前端页面说明](../../frontend/frontend-pages-guide.md)、[能力矩阵](../../design/capability-matrix.md)
> 本文不再表示当前实现状态或开发顺序。

## 目标

建立 `/telemetry` 作为跨线程观测和审计中心。Invocations、Events、Tool Audit、Thread Context 都从 Command 首页移到 Telemetry 页面。

## 前置条件

- Phase 2 完成，首页只保留轻量 runtime status 和 Telemetry 入口。
- 后端 invocation、message、runtime status 已有基础数据。

## 页面结构

```text
/telemetry
├─ TelemetryHeader
├─ TelemetryFilters
├─ ThreadTimeline
├─ InvocationFeed
├─ EventFeed
├─ ToolAudit
└─ ThreadContextPanel
```

## 后端 / SDK 任务

新增或补齐可查询接口：

```text
GET /api/telemetry/threads
GET /api/invocations?threadId=&agentId=&status=&from=&to=
GET /api/events?threadId=&invocationId=&agentId=&type=&from=&to=
GET /api/tool-audit?threadId=&agentId=&tool=&denied=&from=&to=
GET /api/threads/:threadId/context
GET /api/threads/:threadId/context-package/:invocationId
```

第一版必须至少完成：

- `GET /api/telemetry/threads`
- `GET /api/invocations`
- `GET /api/threads/:threadId/context`

`events` 和 `tool-audit` 如果后端尚未持久化，可以先返回空数组加明确 capability flag，但页面结构必须稳定。

## Thread Context 最小字段

```text
thread id / title / mode
projectPath / workspace label
workspace fingerprint
message counts: public / private / revealed / handoff
recent messages summary
current or latest invocation
target agents / route mode / depth / worklist
private visibility summary
recent workspace file tool access
context stale reason
estimated tokens placeholder
```

## 前端任务

1. 实现 `/telemetry` 和 `/telemetry/[threadId]`。
2. 实现 URL filter：
   - threadId
   - agentId
   - status
   - event type
   - workspace
   - time range
3. 实现 `ThreadTimeline`，展示所有 thread 的最新状态、workspace、活跃 Agent、错误数。
4. 实现 `InvocationFeed`，展示 short id、status、route mode、target agents、started、finished、duration。
5. 实现 `EventFeed`，默认格式化事件行，点击展开 JSON。
6. 实现 `ToolAudit`，展示 path、tool、bytes、denied、reason、agent、invocation。
7. 实现 `ThreadContextPanel`，展示 Agent 实际可见上下文的摘要。
8. Command 首页 `Open Telemetry` 必须跳到当前 thread 过滤视图。

## 视觉要求

- Telemetry 是审计工具，优先可读性和过滤效率。
- JSON 默认折叠，不允许大段 JSON 淹没列表。
- 错误、denied、stale、suspected stall 必须有独立状态色。
- 三栏布局在 `>=1440px` 完整显示，较窄桌面可折叠 Context 面板。

## 不做事项

- 不要求第一版实现完整事件重放。
- 不要求第一版实现 token 精确计费。
- 不做图表大屏。
- 不做 OpenTelemetry vendor 集成。

## 验收标准

- `/telemetry` 可展示跨线程状态。
- 从 Command 当前 thread 能跳转到 `/telemetry/[threadId]`。
- 刷新页面后 Telemetry 数据来自后端查询，不依赖上一页内存。
- Thread Context 能解释当前 thread 的 workspace、消息窗口、可见性和最新 invocation。
- Event / Invocation / Tool Audit 有 loading、empty、error 状态。
- 首页没有被移回全局审计大列表。

## 交付文件

- `packages/web/src/app/telemetry/page.tsx`
- `packages/web/src/app/telemetry/[threadId]/page.tsx`
- `packages/web/src/components/telemetry/**`
- `packages/web/src/hooks/useTelemetry.ts`
- `packages/web/src/hooks/useThreadContext.ts`
- `packages/web/src/stores/telemetryStore.ts`
- `packages/sdk/src/index.ts`
- `packages/api/src/routes.ts`
