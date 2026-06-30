# Frontend Phase 1：Next Shell 与设计系统底座

## 目标

把 `packages/web` 迁移到 Next.js App Router，并建立 TheTower 深色 HUD 设计系统底座。Phase 1 不追求重做所有业务页面，但必须让路由、Shell、token 和基础组件先成型。

## 前置条件

- 当前 Vite 前端的主要行为已盘点：agents、threads、messages、invocations、SSE、workspace 输入。
- 根 workspace 仍使用 `pnpm`，API 和 SDK 包名不变。

## 技术任务

1. 将 `@the-tower/web` 运行时从 Vite 切到 Next.js App Router。
2. 移除长期依赖的 `vite` / `@vitejs/plugin-react` 入口，新增 `next.config.ts`、`src/app/layout.tsx`、`src/app/page.tsx`。
3. 保留 `@the-tower/sdk`、`@the-tower/shared`、`lucide-react`。
4. 引入 Tailwind CSS 4 的 Next 集成方式，保留 CSS variable token，并把 Tailwind utility class 作为默认样式写法。
5. 引入 shadcn/ui / Radix primitives 的目录约定，先落地 `button`、`input`、`textarea`、`tabs`、`tooltip`、`dialog`、`select`。
6. 建立 `src/styles/tower-tokens.css` 和 `src/styles/tower-components.css`，其中 `tower-components.css` 只放少量全局 primitive、动画、伪元素和第三方适配。
7. 建立常驻 Shell：
   - `components/shell/AppShell.tsx`
   - `components/shell/CommandShell.tsx`
   - `components/shell/TopCommandBar.tsx`
   - `components/shell/ActivityNav.tsx`
8. 建立通用 HUD primitives：
   - `HudPanel`
   - `PanelHeader`
   - `StatusBadge`
   - `SegmentedControl`
   - `IconButton`
9. 建立目标路由页面占位：
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

- `pnpm --filter @the-tower/web build` 通过。
- `pnpm --filter @the-tower/web lint` 通过。
- `/` 能渲染常驻 Shell 和 Command 占位。
- 所有目标路由能打开，不出现 Next 404。
- Top Command Bar 能显示 API target、health 占位、SSE 状态占位和全局导航。
- `HudPanel`、`StatusBadge`、`SegmentedControl` 至少被一个页面实际使用。
- 新增样式颜色来自 `--tower-*` token。
- 新增页面和基础组件主要使用 Tailwind 原子化 class；`tower-components.css` 没有承载业务组件主体样式。

## 交付文件

- `packages/web/package.json`
- `packages/web/next.config.ts`
- `packages/web/src/app/**`
- `packages/web/src/components/shell/**`
- `packages/web/src/components/ui/**`
- `packages/web/src/design/**`
- `packages/web/src/styles/**`
