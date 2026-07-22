# Frontend Phase 1：Next Shell 与设计系统底座

> 文档状态：Superseded（历史 Phase 记录）
> 当前来源：[前端页面说明](../../frontend/frontend-pages-guide.md)、[能力矩阵](../../design/capability-matrix.md)
> 本文不再表示当前实现状态或开发顺序。

## 目标

把 `packages/web` 迁移到 Next.js App Router，并建立 TheTower 深色 HUD 设计系统底座。Phase 1 不追求重做所有业务页面，但必须让路由、Shell、token 和基础组件先成型。

本 phase 内部分两步交付，1a 未通过不进入 1b：

- **1a Next 接入与数据对齐**：换运行时、路由、API rewrites、SSE 同源代理，让 `/` 与 `/threads/[threadId]` 在 Next 下对齐旧 Vite 行为。旧 Vite 入口保留为可回退 fallback，1a 验收通过后再移除。
- **1b 设计系统底座**：在 1a 可用基础上落地 token、HUD primitives、shadcn/ui 目录约定、占位路由。

## 前置条件

- 当前 Vite 前端的主要行为已盘点：agents、threads、messages、invocations、SSE、workspace 输入。
- 根 workspace 仍使用 `pnpm`，API 和 SDK 包名不变。
- 已在 `packages/web/package.json` 锁定 Next.js 具体 minor 版本并记录锁定日期。

## 技术任务

### 1a：Next 接入与数据对齐

1. 新增 `next.config.ts`、`src/app/layout.tsx`、`src/app/page.tsx`、`src/app/threads/[threadId]/page.tsx`，Next dev server 跑通。
2. 通过 `next.config.ts` rewrites 把 `/api/*` 代理到后端，SSE 必须能通过同源 `/api/events` 工作（见 API 代理节）。
3. 把现有 thread 选择、消息发送、SSE 实时刷新在 Next 下接通，对齐旧 Vite 行为。SSE 客户端走 `EventSource` + `lastEventId/seq` reconnect catch-up。
4. 此阶段保留旧 Vite 入口可运行，作为回退 fallback。
5. 1a 验收通过后再移除 `vite` / `@vitejs/plugin-react` / `vite.config.ts` / `index.html` 等旧入口产物。

### 1b：设计系统底座

1. 保留 `@the-tower/sdk`、`@the-tower/shared`、`lucide-react`。
2. 引入 Tailwind CSS 4 的 Next 集成方式，保留 CSS variable token，并把 Tailwind utility class 作为默认样式写法。
3. 引入 shadcn/ui / Radix primitives 的目录约定，先落地 `button`、`input`、`textarea`、`tabs`、`tooltip`、`dialog`、`select`。
4. 建立 `src/styles/tower-tokens.css` 和 `src/styles/tower-components.css`，其中 `tower-components.css` 只放少量全局 primitive、动画、伪元素和第三方适配。
5. 建立常驻 Shell：
   - `components/shell/AppShell.tsx`
   - `components/shell/CommandShell.tsx`
   - `components/shell/TopCommandBar.tsx`
   - `components/shell/ActivityNav.tsx`
6. 建立通用 HUD primitives：
   - `HudPanel`
   - `PanelHeader`
   - `StatusBadge`
   - `SegmentedControl`
   - `IconButton`
7. 建立目标路由页面占位：
   - `/`
   - `/threads/[threadId]`
   - `/agents`
   - `/agents/[agentId]`
   - `/telemetry`
   - `/telemetry/[threadId]`
   - `/workspaces`
   - `/tasks`
   - `/settings`

## Token 要求

必须至少定义：

```text
--tower-bg-base
--tower-bg-elevated
--tower-bg-panel
--tower-bg-hover
--tower-border-subtle
--tower-border-strong
--tower-border-energy
--tower-text-primary
--tower-text-secondary
--tower-text-muted
--tower-accent-arc
--tower-accent-solar
--tower-accent-void
--tower-accent-strand
--tower-accent-danger
```

业务 JSX 禁止新增 `#080b10` 这类 hex 字符串。特殊一次性颜色也必须先进入 token。

token 分三层：foundation（上列原始色值）、semantic（状态语义，如 `--tower-status-thinking`、`--tower-status-error`）、component alias（高复用 primitive）。状态色必须经 semantic 层映射，组件不直接引用 foundation 原始色。

## 原子化 CSS 要求

- 默认使用 Tailwind utility class 完成布局、间距、颜色、边框、排版和状态。
- shadcn/ui 组件改造时优先通过 `className`、variant 和 CSS variable 适配 TheTower 视觉。
- 不为每个业务组件创建独立 CSS class 或 CSS module。
- `tower-components.css` 只允许放：
  - 全局 reset / base layer。
  - `--tower-*` token 无法覆盖的复杂伪元素。
  - HUD 扫描线、状态脉冲等 keyframes。
  - 第三方组件的必要覆盖。
  - 极少量跨页面复用 primitive。
- 禁止把完整业务组件外观封装成 `.agent-card`、`.mission-feed` 这类大 class 后再在 JSX 中引用。
- 如果 utility class 过长，优先抽 React 组件、variant map 或 `cn()` helper，而不是新增大块 CSS。

## API 代理

Next dev server 应通过 `next.config.ts` rewrites 代理后端 API，前端默认访问同源 `/api/*`。

```text
/api/:path* -> http://127.0.0.1:3000/api/:path*
```

如果现有 API 端口不同，以 `@the-tower/api` 当前 dev 配置为准。SSE 也必须能通过同源路径工作。

## 不做事项

- 不重写业务数据模型。
- 不新增 Telemetry 后端查询接口。
- 不做完整 Agent 配置表单迁移。
- 不做 Tasks 真实 CRUD。
- 不引入认证系统。

## 验收标准

### 1a 验收（通过后才进 1b）

- `pnpm --filter @the-tower/web build` 通过。
- `/` 与 `/threads/[threadId]` 在 Next 下能完成：选 workspace、选 thread、查 Agent 状态、发消息、收 SSE 实时增量。
- SSE reconnect catch-up 行为与旧 Vite 一致：断线重连不丢事件、不串 thread（有对应单元测试）。
- 旧 Vite 入口仍可运行作为回退。

### 1b 验收

- `pnpm --filter @the-tower/web build` 通过。
- `pnpm --filter @the-tower/web lint` 通过，且包含硬编码颜色检测脚本对业务 `.tsx` 零命中。
- 旧 Vite 入口产物（`vite.config.ts`、`index.html` 等）已移除，Next 成为唯一运行时。
- `/` 能渲染常驻 Shell 和 Command 占位。
- 所有目标路由能打开，不出现 Next 404。
- Top Command Bar 能显示 API target、health 占位、SSE 状态占位和全局导航。
- `HudPanel`、`StatusBadge`、`SegmentedControl` 至少被一个页面实际使用。
- 新增样式颜色来自 `--tower-*` token。
- 新增页面和基础组件主要使用 Tailwind 原子化 class；`tower-components.css` 没有承载业务组件主体样式。
- 至少一档响应式断点通过 Playwright smoke 截图检查，布局不崩。

## 交付文件

- `packages/web/package.json`
- `packages/web/next.config.ts`
- `packages/web/src/app/**`
- `packages/web/src/components/shell/**`
- `packages/web/src/components/ui/**`
- `packages/web/src/design/**`
- `packages/web/src/styles/**`
