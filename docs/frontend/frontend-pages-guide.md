# TheTower 前端页面功能说明

> 文档状态：Current
> 最后核验：2026-07-22

本文档说明 `packages/web`（Next.js App Router）各页面的已实现功能与当前暂未实现/占位的能力，供开发与使用参考。发布能力以 [能力矩阵](../design/capability-matrix.md) 为准；早期迁移过程见已归档的 [frontend-development-plan.md](./frontend-development-plan.md)。

所有页面共用常驻 Shell（顶部 `TopCommandBar` + 左侧 `ActivityNav`），跨路由不重挂载；深色 HUD 视觉由 `--tower-*` token 驱动，业务 JSX 零硬编码颜色（由 `scripts/check-no-hex-colors.mjs` 门禁）。

---

## 路由总览

| 路由 | 名称 | 类型 | 实现状态 |
|---|---|---|---|
| `/` | Command 首页（新建 thread 上下文） | 静态 | 完整 |
| `/threads/[threadId]` | 指定 thread 的 Command 工作台 | 动态 | 完整 |
| `/agents` | Agent 配置治理中心 | 静态 | 完整（Tools/Runtime/Audit 占位） |
| `/agents/[agentId]` | 单个 Agent 配置详情 | 动态 | 完整（Tools/Runtime/Audit 占位） |
| `/telemetry` | 跨线程观测与审计 | 静态 | 完整（events/tool-audit live_only） |
| `/telemetry/[threadId]` | 指定 thread 观测入口 | 动态 | 完整 |
| `/workspaces` | 工作区列表 | 静态 | 完整（文件树/搜索占位） |
| `/workspaces/[workspaceId]` | 工作区详情 | 动态 | 完整（文件树/搜索占位） |
| `/tasks` | 任务 / Mission 调度 | 静态 | 完整 |
| `/tasks/[taskId]` | 任务详情 | 动态 | 完整 |
| `/settings` | 系统配置与运维 | 静态 | 部分（多为占位） |

---

## `/` 与 `/threads/[threadId]` — Tower Command

Command 首页，两个路由共用 `CommandShell`。`threadId` 来自 URL（URL truth），thread-scoped store 保留各 thread 的 draft/filter，切换 thread 不清空。

### 已实现
- **Agent Roster**：Agent 装备卡（display name 身份色、mention、provider/model、enabled、runtime status、当前工具、token、`Configure` 跳 `/agents/[id]`）。
- **Thread Navigator**：thread 列表（title、workspace 短名、mode、删除），新建 thread 入口。
- **Mission Feed**：thread 标题、mode 分段控制、working directory 输入+保存、audit filter 分段控制（带计数）、Agent runtime 状态条、消息流、Command Composer。
- **MessageBubble 多态**：user / agent / system / private（虚线 void）/ callback（solar）/ handoff（结构化卡）/ stream（折叠 CLI telemetry），agent 身份色由 `agentId` 稳定派生。
- **Command Composer**：textarea + Send、新 thread 提示 workspace（datalist）、mention chips 占位、send error 状态。
- **快捷入口**：Configure Agents → `/agents`、Open Telemetry → `/telemetry/[threadId]`、Open Workspace → `/workspaces?projectPath=`。
- **状态**：API error（TopCommandBar health）、SSE 断线横幅、send failed（composer error）。

### 暂未实现
- **导航重挂载未消**：`/` ↔ `/threads/[id]` 切换会重挂工作台（SSE 重连、滚动重置）；常驻 Shell 已不重挂，但消息流常驻留待后续。
- **rich block 消息协议**：card / diff / checklist / interactive / tool event 等结构化 rich block 未实现（计划延期项）。
- **mention chips / 命令补全**：`@agent` / `/handoff` / `/review` 仅为占位文本，未接入实际 mention 解析与补全。
- **Command thread header 关联 task**：从 task 建的 thread 标题为 `Task: <title>` 已传达关联，显式 task badge 未加。

---

## `/agents` 与 `/agents/[agentId]` — Agent 配置治理

Agent 长配置从 Command 迁入，首页只保留运行摘要 + Configure 入口。

### 已实现
- **AgentConfigList**：search、enabled 过滤（All/On/Off）、provider/model 摘要、dirty 徽章，选中跳 `/agents/[id]`。
- **AgentDetailPanel tabs**：Overview / Persona / Model / Tools / Runtime / Audit（tab 全部存在）。
- **Overview**：displayName、mentionHandles、enabled、provider、model、身份色、summary。
- **Persona**：roleDescription、personality、strengths、restrictions、background、voice instruct、signature。
- **Model**：provider、model + 参数占位。
- **表单状态**：idle / dirty / saving / saved / error，Save 按钮在 dirty 时启用。
- **保存往返**：编辑 → 保存 → `/api/agents/:id/config` 持久化（写入 `.the-tower/agent-catalog.json`，gitignored）→ Command `AgentStatusCard` 反映新值。

### 暂未实现
- **Tools tab**：只读占位（`enabledTools` / `mcpServers` 空数组 + note），`PATCH /api/agents/:id/tools` 返回 501。工具权限矩阵未建模。
- **Runtime tab**：只读占位（sandbox/approval/timeout/budget/concurrency 全 null + note），`PATCH /runtime` 返回 501。
- **Audit tab**：只读占位（recentErrors / configChanges 空数组 + note）。配置变更追踪与错误聚合未接。
- **离开 dirty 表单的阻塞提示**：Next App Router 无内置路由守卫；当前靠 list + header 双 dirty 徽章 + store 持久草稿表达未保存状态，未做硬阻塞。
- **Model 参数**：temperature / maxTokens / reasoningEffort / fallback 仅占位。

---

## `/telemetry` 与 `/telemetry/[threadId]` — 跨线程观测与审计

Invocations / Events / Tool Audit / Thread Context 从 Command 移入此页。

### 已实现
- **TelemetryFilters**：agent / status / eventType / workspace / from / to，全部进 URL（URL truth）。
- **ThreadTimeline**：所有 thread 的 workspace、active agents、最新 invocation 状态、消息数、错误数；workspace 客户端过滤；选中跳 `/telemetry/[id]`。
- **InvocationFeed**：short id、status、route mode、target agents、started、duration。
- **EventFeed**：默认格式化事件行，点击展开 JSON；最新在前。
- **ToolAudit**：path、tool、bytes、denied reason、agent、invocation；按 workspace 过滤（客户端，经 threads 的 projectPath）。
- **ThreadContextPanel**：thread 信息、消息计数（public/private/revealed/handoff）、最近消息摘要、最新 invocation、active agents、private visibility、stale reason。`<1280px` 折叠。
- **三栏布局**：Timeline | Tabs(Invocations/Events/ToolAudit) | Context。
- **状态**：各 feed 独立 loading / empty / error。

### 暂未实现
- **Telemetry events / tool-audit 查询仍是 live_only**：这两个查询从进程内 500 条热缓存聚合，重启后查询窗口清空；SSE 自身另有 SQLite `event_log`，支持 `Last-Event-ID` replay。
- **events 查询路径偏离文档**：用 `/api/telemetry/events` 而非 `/api/events`，避免与 SSE 流式端点同路径冲突；tool-audit 一并放 `/api/telemetry/tool-audit`。
- **workspace 过滤仅作用于 Timeline + ToolAudit**：invocation/event 无 workspace 字段，其他 feed 不受其影响。
- **Thread Context 字段占位**：`workspaceFingerprint` 与 `estimatedTokens` 为 null + note。
- **`GET /api/threads/:id/context-package/:invocationId`** 文档列出但未实现。
- **token 精确计费**：未实现（计划明确不做第一版）。

---

## `/workspaces` 与 `/workspaces/[workspaceId]` — 工作区与工具活动

可信工作区、thread 绑定、最近文件工具访问，第一版只读观测。

### 已实现
- **WorkspaceList**：name、path（mono）、trusted、last used；`?projectPath=` 高亮匹配项（Command 的 Open Workspace 携带此参数）。
- **WorkspaceDetail**：path、id、trusted、last used、fingerprint 占位。
- **ThreadBindings**：绑定该 workspace 的 thread（title、mode、active agents、最新 invocation），链接 `/telemetry/[id]`。
- **WorkspaceActivityPanel**：file read/write/list、denied reason（danger 色醒目）、bytes、agent、invocation、time。
- **三栏布局**：Detail | Bindings | Activity。

### 暂未实现
- **validity（invalid/stale）实时校验**：列表只显示 `trusted`，未对每个 workspace 调 validate 校验路径是否仍存在。
- **fingerprint**：占位。
- **文件树 / 搜索**：`GET /api/workspaces/:id/files` 与 `/search` 返回空 + `capability: "unavailable"`，SDK 方法名已稳定，后续接入。
- **diff / git / terminal / browser preview**：未实现（计划明确后置）。
- **activity 源自 live_only ring buffer**：进程内事件，重启清空；无近期 file_tool 事件时为空。

---

## `/tasks` 与 `/tasks/[taskId]` — Tasks / Mission

把 thread 组织到 task 对象下，支持从 task 创建 thread。

### 已实现
- **TaskComposer**：新建 task（title、summary、priority、owner、tags、workspace）。
- **TaskBoard**：task 列表 + 过滤（status 分段控制、owner、workspace）；task 卡片显示 priority/status 徽章、summary、owner、linked threads 数、tags。
- **TaskDetailPanel**：task 字段、Linked threads（链接 `/telemetry/[id]`）、从 task 创建 thread（可选初始消息）→ 跳回 `/threads/[id]`。
- **后端**：`GET/POST /api/tasks`、`GET/PATCH /api/tasks/:id`、`POST /api/tasks/:id/create-thread`、`GET /api/tasks/:id/threads`。create-thread 有 content 时复用 `postUserMessage`（触发 Agent 运行），无 content 时建空 thread。

### 暂未实现
- **Tasks 过滤为本地 state**：status/owner/workspace 过滤在 TaskBoard 本地，未进 URL（Tasks 是新域，URL truth 主要约束 threadId/agentId/workspaceId/telemetry filter）。
- **dependency graph / SOP 编辑器**：未实现（计划明确不做第一版）。
- **dispatch / review / risk**：未实现。
- **task → invocation 映射的深度视图**：当前只展示 task → thread，thread → invocation 的跳转经 `/telemetry/[id]` 间接完成。

---

## `/settings` — 系统配置与运维

运维控制台，信息密度优先。

### 已实现
- **Service health**：`/health` 轮询，真实 API ok/error/checking 状态。
- **API connection**：API target（同源 proxied）+ rewrite 说明。
- **Providers**：从 `/api/agents` 聚合，按 provider 统计 total/enabled/model 数。
- **Storage**：trusted workspaces 数量、SQLite 存储位置（`.the-tower/`）。

### 暂未实现（占位）
- **MCP servers**：`unavailable` 占位，MCP server 状态/工具目录/启用禁用未接。
- **Runner & sandbox**：sandbox/timeout/concurrency 全 `—` 占位。
- **Diagnostics**：导出诊断按钮 disabled 占位。
- **provider credentials 状态**：未暴露（计划明确不暴露 secret）。
- **SSE 状态**：未在 Settings 直接展示，见 Command 顶部状态条。

---

## 跨页面一致性

- **workspace label**：`telemetryWorkspaceLabel`（projectPath 末段）同源，Command / Telemetry / Workspace 三处语义一致；无 workspace 的 thread 显示 `No workspace`。
- **URL truth**：`threadId`、`agentId`、`workspaceId`、Telemetry filter 进 URL；Tasks 过滤为例外（本地 state）。
- **状态色**：Agent 运行时状态、invocation status、task status/priority、连接状态均经 semantic token 映射（`--tower-status-*`）。
- **常驻 Shell**：`TopCommandBar`（brand + API target + health + SSE 占位 + 全局导航）+ `ActivityNav`（Command/Agents/Telemetry/Workspaces/Tasks/Settings）跨路由不重挂。

---

## 全局验证基线

- 发布门禁统一执行 `pnpm test:ci`，包含 lint、production build、unit、integration、migration 和 production Playwright 主链。
- Playwright 当前覆盖创建 Thread、发送并展示 Mock CLI Output、Stop、private callback reveal、稳定 Provider 失败展示与 SSE `Last-Event-ID` 断线重连。
- 精确测试数量不在本文手工维护，以 CI 输出和 [能力矩阵](../design/capability-matrix.md) 的证据链接为准。

## 后续增强方向（计划中已显式延期）

- rich block 消息协议（card / diff / checklist / interactive / tool event）。
- Memory / Context 长期记忆模块（evidence search / collection / context builder health）。
- workspace 文件树 / 搜索 / diff / git / terminal / browser preview。
- Tasks dependency graph / SOP / dispatch / risk。
- Settings MCP / runner / sandbox / diagnostics 真实接入。
- Command 消息流常驻（消除 `/` ↔ `/threads/[id]` 导航重挂）。
