# Frontend Phase 5：Workspace 与工具活动

## 目标

建立 `/workspaces` 页面，让用户能看清 thread 绑定了哪个工作区，以及 Agent 最近进行了哪些文件工具访问。第一版以只读观测为主。

## 前置条件

- Workspace Phase 1-6 的基础能力可用：workspace validate、thread projectPath 绑定、前端创建 thread 时选择工作区。
- Phase 4 已定义或实现 Tool Audit 的最小数据结构。

## 页面结构

```text
/workspaces
├─ WorkspaceHeader
├─ WorkspaceList
├─ WorkspaceDetail
├─ ThreadBindings
└─ WorkspaceActivityPanel
```

## 后端 / SDK 任务

```text
GET /api/workspaces
GET /api/workspaces/:id
GET /api/workspaces/:id/activity
GET /api/workspaces/:id/files?path=
GET /api/workspaces/:id/search?q=
```

第一版必须完成：

- `GET /api/workspaces`
- `GET /api/workspaces/:id/activity`

文件树和搜索可以返回 capability unavailable，但 SDK 方法名先稳定。

## 前端任务

1. 实现 `/workspaces` 列表页。
2. 实现 `/workspaces/[workspaceId]` 详情页，或者先用 query state 选择详情。
3. 展示 workspace：
   - name
   - path
   - trusted / invalid / stale 状态
   - fingerprint
   - last used
4. 展示 thread bindings：
   - thread title
   - mode
   - last invocation
   - active agents
5. 展示 workspace activity：
   - file read / write / list
   - denied records
   - bytes
   - path
   - agent
   - invocation
   - time
6. Command 首页 workspace label 链接到对应 workspace。
7. Telemetry ToolAudit 可按 workspace 过滤。

## 视觉要求

- Workspace 页面是操作台侧面板，不是文件管理器首页。
- 路径、hash、invocation id 使用 mono 字体。
- denied / danger 操作必须比普通 read/list 更醒目。

## 不做事项

- 不做可写文件编辑器。
- 不做 git diff。
- 不做 terminal。
- 不做 browser preview。
- 不做文件搜索高亮 UI。

## 验收标准

- 用户能在 `/workspaces` 看见可信工作区和最近使用记录。
- 用户能知道某个 thread 绑定到哪个 workspace。
- 用户能看到最近文件工具访问和 denied reason。
- Command、Telemetry、Workspace 三处 workspace label 语义一致。
- 没有 workspace 的旧 thread 有明确 `No workspace` 状态。

## 交付文件

- `packages/web/src/app/workspaces/page.tsx`
- `packages/web/src/app/workspaces/[workspaceId]/page.tsx`
- `packages/web/src/components/workspace/**`
- `packages/web/src/hooks/useWorkspaceActivity.ts`
- `packages/web/src/stores/workspaceStore.ts`
- `packages/sdk/src/index.ts`
- `packages/api/src/routes.ts`
