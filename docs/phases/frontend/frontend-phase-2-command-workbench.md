# Frontend Phase 2：Command 首页工作台

> 文档状态：Superseded（历史 Phase 记录）
> 当前来源：[前端页面说明](../../frontend/frontend-pages-guide.md)、[能力矩阵](../../design/capability-matrix.md)
> 本文不再表示当前实现状态或开发顺序。

## 目标

把首页从调试四列布局重做为 Tower Command：Agent Roster、Thread Navigator、Mission Feed 三个核心区域。首页只承载当前任务编排，不再展示全局 Invocation / Event 大列表。

## 前置条件

- Phase 1 完成，Next Shell 和目标路由可用。
- 现有 agents、threads、messages、post message、SSE 状态可以通过 SDK 或兼容 client 访问。

## 页面结构

```text
TopCommandBar
└─ CommandShell
   ├─ AgentRoster
   ├─ ThreadNavigator
   └─ MissionFeed
```

## 技术任务

1. 将原 `App.tsx` 中的 Command 相关数据请求迁移到 hooks：
   - `useTowerClient`
   - `useAgents`
   - `useThreads`
   - `useThreadMessages`
   - `useEventStream`
   - `useThreadRuntime`
2. 建立 thread-scoped store：
   - `currentThreadId`
   - `draftByThreadId`
   - `filtersByThreadId`
   - `unreadByThreadId`
   - `scrollStateByThreadId`
3. 实现 `AgentRoster` 和 `AgentStatusCard`：
   - display name
   - mention handle
   - provider / model
   - enabled
   - runtime status
   - current tool
   - configure link
4. 实现 `ThreadNavigator` 和 `ThreadListItem`：
   - title
   - workspace short name
   - mode
   - updated time
   - last invocation status
   - create / delete action
5. 实现 `MissionFeed`：
   - thread header
   - mode segmented control
   - audit filter segmented control
   - runtime status strip
   - message list
   - command composer
6. 实现 `MessageBubble` 多态：
   - user
   - agent
   - system
   - private
   - callback
   - handoff
   - stream output
7. 实现 `CommandComposer`：
   - textarea
   - send button
   - disabled / sending / error state
   - workspace prompt for new thread
   - mention chips 占位
8. 首页增加快捷入口：
   - `Configure Agents` -> `/agents`
   - `Open Telemetry` -> `/telemetry/[threadId]`
   - `Open Workspace` -> `/workspaces`

## 视觉要求

- 三列信息密度优先，桌面宽度优先保证 `>=1280px`。
- Agent 卡片像装备卡，但只展示运行摘要，不展示长表单。
- MessageBubble 使用 Agent 身份色和状态色，不只靠文字区分 private / callback / handoff。
- Composer 像命令输入，但仍保持 textarea 可读性。
- 首页不出现大面积 hero、营销文案、装饰光球。
- 页面布局和业务组件优先使用 Tailwind 原子化 class；重复状态通过 variant map、`cn()` helper 或小型组件抽象解决。
- 不为 `AgentRoster`、`ThreadNavigator`、`MissionFeed`、`MessageBubble` 创建大型独立 CSS class。

## 不做事项

- 不实现完整 Agent 配置编辑。
- 不实现 Telemetry 过滤页面。
- 不实现文件树、diff、git。
- 不把 Tasks 做成真实业务对象。

## 验收标准

- `/` 和 `/threads/[threadId]` 都能进入 Command 工作台。
- 用户可以选择 thread、创建 thread、发送消息、刷新消息。
- 新 thread 仍可指定 workspace / projectPath。
- Agent 主侧栏只展示运行状态和配置入口。
- 首页没有全局 Invocations / Events 大列表。
- private / public / callback / handoff / stream 在消息流中视觉可区分。
- Thread 切换不清空其他 thread 的 draft。
- API error、SSE disconnected、send failed 都有明确状态。
- Command 页面新增样式主要由 Tailwind utility 和 `--tower-*` token 组成。

## 交付文件

- `packages/web/src/app/page.tsx`
- `packages/web/src/app/threads/[threadId]/page.tsx`
- `packages/web/src/components/command/**`
- `packages/web/src/hooks/useThreads.ts`
- `packages/web/src/hooks/useThreadMessages.ts`
- `packages/web/src/hooks/useEventStream.ts`
- `packages/web/src/stores/threadStore.ts`
