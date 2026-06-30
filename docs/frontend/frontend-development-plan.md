# TheTower 前端开发总控文档

来源视觉方案：[TheTower 前端视觉与页面设计方案：Destiny 2 风格](./destiny-2-frontend-design.md)

## 目标

把当前 `packages/web` 从 React + Vite 调试控制台升级为基于 Next.js App Router 的多 Agent 指挥台。第一屏必须是可操作工作台，不做 landing page；Agent 配置、Telemetry、Workspace、Tasks、Settings 都按独立页面边界推进。

本总控文档约束技术栈、目录边界、路由规划、phase 顺序和验收门槛。各 phase 只能在满足前置验收后进入下一阶段，避免继续把所有能力堆进 `App.tsx`。

## 技术栈

### 基础

- Monorepo：继续使用 `pnpm` workspace。
- Runtime：Node.js `>=20`，沿用根 `package.json` 的 engines。
- 语言：TypeScript，前端代码必须通过 `tsc --noEmit` 或 Next build 类型检查。
- 包名：继续使用 `packages/web` 和 `@the-tower/web`，不新增并行前端包。

### 前端框架

- Framework：Next.js App Router。
- 版本策略：以 Next.js 16.x 作为规划基线；Phase 1 实施当天锁定官方 stable patch，并记录到 `packages/web/package.json`。
- React：使用 Next App Router 支持的 React 19 能力，不再把 Vite 作为长期运行时。
- 路由：使用文件系统路由和 `app/` 目录；不引入 React Router。
- Shell：使用常驻 `CommandShell` / `AppShell`，路由变化只改变页面内容和当前上下文，不能让全局 SSE、thread-scoped state、消息滚动状态反复重挂载。

### 样式与 UI

- Styling：Tailwind CSS 4 + CSS variables。
- CSS 策略：尽量使用 Tailwind 原子化 utility class；组件样式优先写在 JSX 的 `className` / variant 配置中。
- Token：建立 `--tower-*` 设计 token，业务 JSX 中禁止新增散落 hex color。
- 自定义 CSS 边界：CSS 文件只放 `--tower-*` token、全局 reset、字体/滚动条、复杂伪元素、动画 keyframes、第三方组件适配和少量无法用 utility 清晰表达的基础层。
- `@apply` 边界：不把整套组件外观搬进 `@apply` class；只允许用于极少量高复用底层 primitive，且必须比直接写 utility 更清晰。
- UI primitives：shadcn/ui + Radix UI，生成代码放入 `packages/web/src/components/ui/`。
- 图标：继续使用 `lucide-react`。
- 视觉：遵守 Destiny 2 风格方案中的深色 HUD、细边框、4-6px 圆角、状态色和信息密度约束。
- 禁止：Ant Design、MUI、Chakra 等强视觉大型组件库；禁止使用 Destiny 2 原始 Logo、截图、图标或受版权保护素材。

### 状态与数据

- Server truth：后端 API 是事实源，前端事件流只做 live 增量。
- SDK：优先通过 `@the-tower/sdk` 调 API，缺口先补 SDK 方法。
- Realtime：第一轮继续使用 SSE；Telemetry 必须逐步改为可查询、可重放，不依赖前端内存事件数组。
- Client state：使用 Zustand 管理跨路由 UI state 和 thread-scoped state；简单局部表单状态仍可使用 React state。
- URL truth：`threadId`、`agentId`、`workspaceId`、Telemetry filter 能进 URL 的必须进 URL。

### 测试与验证

- 基础验证：`pnpm --filter @the-tower/web lint` 和 `pnpm --filter @the-tower/web build`。
- 共享契约变更：同步跑相关 API / SDK tests。
- UI phase 完成时必须有至少一个桌面视口人工或 Playwright smoke 截图检查，确认主布局无重叠、无空白主场景、状态可读。
- 视觉 token、原子化 CSS 和组件拆分阶段不要求端到端业务覆盖，但不能破坏现有 thread、message、invocation 基础操作。

## 目标路由

```text
/                         Command 首页，默认进入最近或新建 thread
/threads/[threadId]       指定 thread 的 Command 工作台
/agents                   Agent 配置治理中心
/agents/[agentId]         单个 Agent 配置详情
/telemetry                跨线程观测与审计
/telemetry/[threadId]     指定 thread 的观测入口
/workspaces               工作区与文件活动
/workspaces/[workspaceId] 工作区详情
/tasks                    任务 / Mission
/tasks/[taskId]           任务详情
/settings                 系统配置与运维
```

第一阶段可以让部分页面显示占位，但路由边界必须先存在。后续页面实现不能回退到单页 `activeView`。

## 目标目录

```text
packages/web/
  next.config.ts
  src/
    app/
      layout.tsx
      page.tsx
      threads/[threadId]/page.tsx
      agents/page.tsx
      agents/[agentId]/page.tsx
      telemetry/page.tsx
      telemetry/[threadId]/page.tsx
      workspaces/page.tsx
      workspaces/[workspaceId]/page.tsx
      tasks/page.tsx
      tasks/[taskId]/page.tsx
      settings/page.tsx
    components/
      shell/
      command/
      agents/
      telemetry/
      workspace/
      tasks/
      ui/
    design/
      tokens.ts
      status.ts
    hooks/
    stores/
    lib/
    styles/
      globals.css
      tower-tokens.css
      tower-components.css   少量全局 primitive / 动画 / 第三方适配，不承载业务组件主体样式
```

`src/app/**/page.tsx` 只做路由入口和轻量组合，业务逻辑放到 `components/`、`hooks/`、`stores/`、`lib/`。

## Phase 顺序

1. [Frontend Phase 1：Next Shell 与设计系统底座](../phases/frontend/frontend-phase-1-next-shell-design-system.md)
2. [Frontend Phase 2：Command 首页工作台](../phases/frontend/frontend-phase-2-command-workbench.md)
3. [Frontend Phase 3：Agent 配置治理](../phases/frontend/frontend-phase-3-agent-configuration.md)
4. [Frontend Phase 4：Telemetry 与 Thread Context](../phases/frontend/frontend-phase-4-telemetry-context.md)
5. [Frontend Phase 5：Workspace 与工具活动](../phases/frontend/frontend-phase-5-workspace-tool-activity.md)
6. [Frontend Phase 6：Tasks / Mission 与 Settings 收口](../phases/frontend/frontend-phase-6-tasks-settings.md)

## 开发约束

- 每个 phase 都必须保留上一阶段可用功能，不接受纯静态重写导致现有 API 流程不可用。
- 首页只服务当前任务编排：Agent 运行状态、Thread 导航、Mission Feed、Command Composer。
- Agent 长配置必须进入 `/agents`，不能继续塞在 Command 侧栏。
- Invocations、Events、Tool Audit、Thread Context 必须进入 `/telemetry`，首页只保留轻量状态和跳转入口。
- Workspace 文件树、diff、git、terminal、browser preview 可以后置，但 workspace label、绑定关系和工具活动必须先产品化。
- 业务组件默认使用 Tailwind 原子化 class；重复状态样式必须沉到 token、variant 或组件 API，避免复制大段 class 字符串。
- 不新增面向业务组件的大型 BEM / CSS module 样式层；如果必须新增自定义 class，要在代码附近说明 utility class 无法清晰表达的原因。
- 新增后端 API 时先补 shared type / SDK，再接页面。

## 全局完成标准

- Next.js App Router 成为 `@the-tower/web` 唯一前端运行时。
- 用户进入 `/` 或 `/threads/[threadId]` 后能立刻选择工作区、选择 thread、查看 Agent 状态并发送消息。
- `/agents` 能承载 Agent identity、persona、model、tools、runtime 的治理界面。
- `/telemetry` 能跨 thread 查询 invocation、event、tool audit，并展示所选 thread context。
- `/workspaces` 能展示可信工作区、thread 绑定和最近工具访问。
- `/tasks` 至少能表达 task -> thread -> invocation 的映射。
- 所有核心状态都有 loading、empty、error、stale 或 disabled 呈现。
- 深色 HUD 视觉由 token 驱动，业务 JSX 中没有新增硬编码主题色。
- 主要页面和业务组件以原子化 CSS 实现，自定义 CSS 只覆盖总控文档允许的边界。

## 参考

- Next.js 官方文档：App Router、`app/` 项目结构、rewrites。
- 本仓库视觉方案：`docs/frontend/destiny-2-frontend-design.md`。
- 本仓库现有工作区阶段：`docs/phases/workspace/workspace-phase-6-frontend-experience.md`。
