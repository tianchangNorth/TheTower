# Frontend Phase 6：Tasks / Mission 与 Settings 收口

> 文档状态：Superseded（历史 Phase 记录）
> 当前来源：[前端页面说明](../../frontend/frontend-pages-guide.md)、[能力矩阵](../../design/capability-matrix.md)
> 本文不再表示当前实现状态或开发顺序。

## 目标

补齐 TheTower 的任务组织和系统运维入口，让 Command 首页不承担长期 backlog、系统配置和诊断职责。

## 前置条件

- Phase 2-5 完成，Command、Agents、Telemetry、Workspace 的页面职责已经分离。
- Thread、Invocation、Workspace 数据已经能支持 task 映射。

## Tasks 页面

### 页面结构

```text
/tasks
├─ TaskBoard
├─ TaskFilters
└─ TaskDetailPanel
```

### 后端 / SDK 任务

```text
GET /api/tasks
POST /api/tasks
GET /api/tasks/:id
PATCH /api/tasks/:id
POST /api/tasks/:id/create-thread
GET /api/tasks/:id/threads
```

### 前端任务

1. 展示 task card：
   - title
   - summary
   - priority
   - status
   - tags
   - owner agent
   - linked threads
2. 支持从 task 创建 thread。
3. 展示 task -> thread -> invocation 关系。
4. 支持基础过滤：status、owner、workspace、updated time。
5. Command thread header 展示关联 task。

## Settings 页面

### 页面结构

```text
/settings
├─ ServiceHealth
├─ ApiConnection
├─ ProviderStatus
├─ McpServerStatus
├─ RunnerConfig
└─ Diagnostics
```

### 前端任务

1. 将 API base、SSE 状态、服务健康从 Command header 的详细配置中抽到 Settings。
2. 展示 provider credentials 状态，但不暴露 secret。
3. 展示 MCP server 状态、工具目录、启用/禁用占位。
4. 展示 runner、sandbox、storage/db 摘要。
5. 提供诊断导出入口占位。

## 视觉要求

- Tasks 是任务调度面，不做营销式 mission page。
- Settings 是运维控制台，信息密度和可扫描性优先。
- 危险设置使用明确状态色、确认对话框和禁用态。

## 不做事项

- 不做复杂 dependency graph。
- 不做 SOP 编辑器。
- 不做 secret 管理 UI。
- 不做插件市场。
- 不做通知中心。

## 验收标准

- `/tasks` 能展示任务列表和 task-thread 关系。
- 用户可以从 task 创建 thread，并跳回 Command 工作台。
- `/settings` 能展示 API、SSE、provider、MCP、runner 的状态摘要。
- Command 首页不再承载全局 settings 细节。
- 所有新页面都可从 ActivityNav 到达。

## 交付文件

- `packages/web/src/app/tasks/page.tsx`
- `packages/web/src/app/tasks/[taskId]/page.tsx`
- `packages/web/src/app/settings/page.tsx`
- `packages/web/src/components/tasks/**`
- `packages/web/src/components/settings/**`
- `packages/web/src/hooks/useTaskBoard.ts`
- `packages/web/src/stores/taskStore.ts`
- `packages/sdk/src/index.ts`
- `packages/api/src/routes.ts`
