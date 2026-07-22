# TheTower 前端开发总控文档

> 文档状态：Superseded（Next.js 迁移历史计划）
> 当前来源：[前端页面说明](./frontend-pages-guide.md)、[技术 Roadmap](../ROADMAP.md)
> 保留目的：记录 Vite → Next.js 的阶段实施与验收边界，不再约束当前开发顺序。

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
- 版本策略：以 Next.js 16.x 作为规划基线。Phase 1 启动前必须在 `packages/web/package.json` 锁定一个具体 minor（如 `16.x` 的最新 stable），并在文档中记录锁定版本与锁定日期；后续升级走显式变更，不允许"实施当天再定"导致基线漂移。
- React：使用 Next App Router 支持的 React 19 能力，不再把 Vite 作为长期运行时。
- 路由：使用文件系统路由和 `app/` 目录；不引入 React Router。
- Shell：使用常驻 `CommandShell` / `AppShell`，路由变化只改变页面内容和当前上下文，不能让全局 SSE、thread-scoped state、消息滚动状态反复重挂载。
- 渲染边界：App Router 的 Server / Client Component 边界必须显式划分。首屏列表（threads、agents、workspaces）优先 Server Component 拉首屏数据，实时增量交给客户端 SSE 订阅组件；Zustand store 仅存在于 Client Component 子树，不跨 RSC 边界。
- 数据获取：列表/详情首屏走 Next `fetch` + 路由段缓存，实时数据走 SSE 增量对齐；不准用客户端 `useEffect` 拉首屏列表再覆盖。`fetch` 缓存策略按路由显式标注（no-store / revalidate / static），不能留默认值。
- SSE 落地：SSE 通道以 Next route handler 或同源 `/api/events` 代理提供，客户端通过 `EventSource` + `lastEventId/seq` 做 reconnect catch-up；不允许把 SSE 长连接塞进 Server Component。

### 样式与 UI

- Styling：Tailwind CSS 4 + CSS variables。
- CSS 策略：尽量使用 Tailwind 原子化 utility class；组件样式优先写在 JSX 的 `className` / variant 配置中。
- Token：建立 `--tower-*` 三层设计 token —— foundation（原始色值）、semantic（状态语义，如 `--tower-status-thinking`、`--tower-status-error`）、component alias（高复用 primitive）。状态色必须经 semantic 层映射，不允许组件直接引用 foundation 原始色，避免状态样式散落。
- 颜色门禁：业务 JSX 中禁止新增散落 hex color。该约束以自定义 lint 脚本强制执行（检测 `.tsx` 中 `#[0-9a-fA-F]{3,8}` 字面量，token 文件白名单除外），并接入 `pnpm --filter @the-tower/web lint`；不允许仅靠 review 自觉。
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
- 颜色门禁：`pnpm --filter @the-tower/web lint` 必须包含硬编码颜色检测脚本（见样式与 UI 节），失败即阻断 phase 验收。
- 组件/状态测试：Zustand store 纯函数 reducer、SSE reconnect catch-up（`lastEventId/seq` 对齐）、URL truth 同步（`threadId/agentId/workspaceId` ↔ store）必须有单元测试覆盖，不能只靠 build 通过。
- 共享契约变更：同步跑相关 API / SDK tests。
- UI phase 完成时必须有至少一个桌面视口人工或 Playwright smoke 截图检查，确认主布局无重叠、无空白主场景、状态可读；Playwright smoke 至少覆盖 4 档响应式断点（≥1440 / 1280-1439 / 1024-1279 / <1024）中的一档，验证布局不崩。
- 视觉 token、原子化 CSS 和组件拆分阶段不要求端到端业务覆盖，但不能破坏现有 thread、message、invocation 基础操作。

## 迁移策略（Vite → Next）

从 Vite 单页切到 Next App Router 是本次计划最高风险的一段，不允许就地整体替换导致现有 thread / message / invocation / SSE 流程中断。迁移按以下控制策略推进：

- 包策略：仍使用 `packages/web` / `@the-tower/web`，但在 Phase 1 内分两步交付：
  - **1a Next 接入**：落地 `next.config.ts`、`app/layout.tsx`、`app/page.tsx`、API rewrites、SSE 同源代理；`/` 与 `/threads/[threadId]` 必须能在 Next 下完成 thread 选择、消息发送、SSE 实时刷新，对齐旧 Vite 行为后才能进入 1b。此阶段保留旧 Vite 入口为可回退 fallback，直到 1a 验收通过。
  - **1b 设计系统底座**：在 1a 可用基础上落地 token、HUD primitives、shadcn/ui 目录约定和占位路由。1a 未通过则不进入 1b。
- SSE 切换：SSE 是迁移中最易断的链路。1a 必须先验证 Next route handler / 同源代理下 `EventSource` + `lastEventId/seq` reconnect 与旧实现行为一致（断线恢复、不丢事件、不串 thread），否则视为迁移未完成。
- 数据对齐：1a 验收以"旧 Vite 能做的核心操作在 Next 下均可做"为准——选 workspace、选 thread、查 Agent 状态、发消息、收 SSE 增量。任何一项回退即阻断。
- 回退条件：1a 验收未通过且短期内不可修复时，保留旧 Vite 入口继续服务，不得用半成品 Next 入口顶替生产路径。

## 与视觉方案的差异说明

本总控文档相对 `destiny-2-frontend-design.md` 做了范围收拢，显式声明如下，避免读者误以为被吞掉的能力已废弃：

- **路由前置**：视觉方案 Phase 8 的"路由与常驻 Shell"被提前到 Phase 1，因为 Next App Router 一开始就要求路由边界。
- **rich block 协议延期**：视觉方案 Phase 7 的 rich block（card / diff / checklist / interactive / tool event）、handoff 结构化情报卡、events 默认格式化，**不在本计划 6 个 phase 内**，作为后续增强方向保留，不在当前总控验收范围。
- **Memory / Context 模块延期**：视觉方案的 Memory 模块在本计划无独立路由（无 `/memory`）；Thread Context 快照在 Phase 4 落地，长期记忆/evidence search 作为后续方向保留。
- **响应式**：视觉方案的 4 档断点（≥1440 / 1280-1439 / 1024-1279 / <1024）作为非功能要求保留，Phase 1 起的 smoke 检查至少覆盖一档；首页与 Telemetry 三栏布局的折叠行为按视觉方案执行。

## 与 workspace phase 的边界

`docs/phases/workspace/workspace-phase-*.md` 已实施 workspace 管理、thread 绑定与 MCP 工具（见 git 历史）。本计划 Phase 5（Workspace 与工具活动）**不重做**已落地的后端能力，仅做前端产品化：workspace 列表、绑定关系、工具活动展示。两者职责为：

- workspace phase：后端 workspace / MCP 工具能力的事实源。
- 本计划 Phase 5：消费上述后端能力的前端页面与组件。
冲突时以后端已落地契约为准，前端补 SDK 缺口而非改后端。

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

1. [Frontend Phase 1：Next Shell 与设计系统底座](../phases/frontend/frontend-phase-1-next-shell-design-system.md) —— 内部分 1a（Next 接入 + SSE/数据对齐）与 1b（设计系统底座），见迁移策略节。
2. [Frontend Phase 2：Command 首页工作台](../phases/frontend/frontend-phase-2-command-workbench.md)
3. [Frontend Phase 3：Agent 配置治理](../phases/frontend/frontend-phase-3-agent-configuration.md)
4. [Frontend Phase 4：Telemetry 与 Thread Context](../phases/frontend/frontend-phase-4-telemetry-context.md)
5. [Frontend Phase 5：Workspace 与工具活动](../phases/frontend/frontend-phase-5-workspace-tool-activity.md) —— 前端产品化，不重做已落地后端，见与 workspace phase 的边界节。
6. [Frontend Phase 6：Tasks / Mission 与 Settings 收口](../phases/frontend/frontend-phase-6-tasks-settings.md)

后续增强（不在 6 phase 验收内）：rich block 协议、handoff 情报卡、events 格式化、Memory / Context 长期记忆模块。

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

- Next.js App Router 成为 `@the-tower/web` 唯一前端运行时，Vite 入口已移除。
- 用户进入 `/` 或 `/threads/[threadId]` 后能立刻选择工作区、选择 thread、查看 Agent 状态并发送消息；SSE 断线重连后不丢事件、不串 thread（有对应单元测试）。
- `/agents` 能承载 Agent identity、persona、model、tools、runtime 的治理界面。
- `/telemetry` 能跨 thread 查询 invocation、event、tool audit，并展示所选 thread context；Telemetry 不依赖前端 SSE 内存数组，首屏走后端查询接口。
- `/workspaces` 能展示可信工作区、thread 绑定和最近工具访问。
- `/tasks` 至少能表达 task -> thread -> invocation 的映射。
- 所有核心状态都有 loading、empty、error、stale 或 disabled 呈现。
- 深色 HUD 视觉由 token 驱动：`pnpm --filter @the-tower/web lint` 的颜色检测脚本对业务 `.tsx` 零命中（token 文件白名单除外）。
- 主要页面和业务组件以原子化 CSS 实现，自定义 CSS 只覆盖总控文档允许的边界（`tower-components.css` 行数与职责可复核）。
- 至少一档响应式断点通过 Playwright smoke 截图检查，布局不崩。

## 参考

- Next.js 官方文档：App Router、`app/` 项目结构、rewrites。
- 本仓库视觉方案：`docs/frontend/destiny-2-frontend-design.md`。
- 本仓库现有工作区阶段：`docs/phases/workspace/workspace-phase-6-frontend-experience.md`。
