# 新建 Thread 弹窗化开发文档

> 文档状态：Superseded（历史功能实施方案）
> 当前来源：[前端页面说明](./frontend-pages-guide.md)、[能力矩阵](../design/capability-matrix.md)
> 保留目的：记录新建 Thread 交互的设计过程，不代表当前 Workspace 安全或页面状态。

## 背景与现状

Command 首页 `/`（未选中 thread 时）当前的新建 thread 流程存在重复与割裂：

- `MissionFeed` 标题在未选中 thread 时显示占位 **"New thread"**（`MissionFeed.tsx:89`）。
- `MissionFeed` 控制行有一个 **"Working directory"** 输入框 + Save 按钮（`MissionFeed.tsx:135`），在 `/`（无 thread）时 Save 被禁用但输入框仍在。
- `CommandComposer` 在 `showWorkspace = !threadId` 时又渲染一个 **"Working directory"** 输入框（`CommandComposer.tsx:37`）。

因此在 `/` 页面同时出现**两个 "Working directory" 输入**和一个 "New thread" 占位标题，职责不清。当前创建 thread 的实际路径是：用户在 composer 里填 workspace + 文本 → Send → `POST /api/messages`（带 projectPath）→ 后端才创建 thread。workspace 与 thread 标题都在"发首条消息"时隐式确定，没有显式命名/选路径的步骤。

## 目标

- 移除上述两个内联 "Working directory" 输入与 "New thread" 占位标题。
- 首次进入或未选 thread 时，`/` 不再展示空的工作台，而是展示一个**首页（HomePage 仪表盘）**：最近 threads、agent 概览、快捷入口、New thread CTA。
- 用户点击 **New thread**（HomePage CTA 或 `ThreadNavigator` 的 New）时，弹出**新建 Thread 弹窗**，让用户选择 **workspace path**（带路径选择器）与 **thread name**（+ mode），确认后创建 thread 并跳转到该 thread 的 Command 工作台。
- workspace 选择集中在弹窗内完成；`CommandComposer` 回归纯消息输入；`CommandShell` 仅在 `/threads/[threadId]` 渲染。

## 后端 / SDK 改动

当前没有"创建空 thread"的接口（thread 只在 `POST /api/messages` 时随首条消息隐式创建）。需新增显式创建接口。

### `POST /api/threads`

创建一个空 thread（带 title / projectPath / mode），返回 thread。

```text
POST /api/threads
body: { title: string, projectPath?: string, mode?: "debug" | "play" }
200 -> { thread: Thread }
400 -> { error: string }
```

行为：
- `title` 必填（min 1）。
- `projectPath` 可选；提供时复用现有 `normalizeProjectPathPatch` 逻辑：校验路径、可信工作区 upsert、返回规范化路径。
- `mode` 可选，默认 `debug`。
- `id` 用 `nanoid()`，`createdAt/updatedAt` 用 `Date.now()`，写入 `threadStore.create`。
- **不**在此处创建消息或触发 Agent 运行（空 thread）。用户进入 thread 后在 composer 发首条消息触发 invocation。
- 不发布 SSE 事件（`ServerEvent` union 无 `thread.created`；Telemetry 线程列表来自 `threadStore.list()`，新建后刷新即可见）。

### `GET /api/dirs`（路径选择器后端）

浏览器无法直接获取本地绝对路径（File System Access API 只返回 handle，不暴露路径字符串）。路径选择器需要后端浏览服务器文件系统目录。

```text
GET /api/dirs?path=<absPath>
path 缺省 -> 取 os.homedir()
200 -> { path: string, parent?: string, entries: Array<{ name: string; path: string }> }
400 -> { error: string }   （路径不存在或非目录）
```

行为：
- `path` 解析为绝对路径并 `realpath`；不存在或非目录 → 400。
- `entries` 仅列出 `path` 的**一级子目录**（非文件），按名称排序，跳过隐藏目录（`.` 开头）以减少噪声。
- `parent` 为上一级目录路径（便于"返回上级"），根目录时为 undefined。
- 安全：仅目录列表，不读取文件内容。v1 允许浏览任意绝对路径（运维型工具，操作者即本机用户）；后续可加 allow-root 限制。

### shared 类型

```ts
export interface CreateThreadRequest {
  title: string;
  projectPath?: string;
  mode?: ThreadMode;
}
export interface CreateThreadResponse {
  thread: Thread;
}
export interface DirEntry {
  name: string;
  path: string;
}
export interface DirListResponse {
  path: string;
  parent?: string;
  entries: DirEntry[];
}
```
（`Thread` / `ThreadMode` 已存在。）

### SDK

- `TheTowerClient.createThread(input: CreateThreadRequest): Promise<CreateThreadResponse>` → `POST /api/threads`。
- `TheTowerClient.listDirs(path?: string): Promise<DirListResponse>` → `GET /api/dirs?path=`。

## 前端改动

### 1. 通用 Dialog primitive（表单弹窗）

现有全局确认弹窗（`ConfirmDialogProvider` + `ui/alert-dialog.tsx`）是 confirm 语义（标题/描述/确认/取消），无法承载表单输入。需新增一个通用 **Dialog**（基于 `@radix-ui/react-dialog`），用于承载 `CreateThreadDialog` 这类表单弹窗。

- `components/ui/dialog.tsx`：shadcn 风格 `Dialog / DialogContent / DialogHeader / DialogTitle / DialogDescription / DialogFooter`，HUD token 视觉（与 `alert-dialog` 一致：能量边框、深色面板、blur 遮罩）。
- 复用既有 `Button` / `Input` / `Select` 作为弹窗内控件。

### 2. `CreateThreadDialog` 组件

`components/command/CreateThreadDialog.tsx`（`'use client'`）：

- 受控开关：`open: boolean` / `onOpenChange` / `onCreated(thread)`。由全局 `CreateThreadDialogProvider` 持有并处理导航（见 §3）。
- 字段：
  - **Thread name**（`Input`，必填）。
  - **Workspace path**：只读展示当前选中路径 + **Browse…** 按钮打开 `PathPicker`；同时保留 trusted workspaces 的快捷下拉（datalist 或 Select）作为快速选择。Browse 选定后回填 path。
  - **Mode**（`Select`：debug / play，默认 debug，字段保留但当前为 no-op）。
- 状态：`idle / creating / error`；Create 按钮 disabled 当 name 为空或 creating。
- 提交：`client.createThread({ title, projectPath: path || undefined, mode })` → 成功后 `onCreated(thread)`；失败显示 error 文案。
- 取消/ESC/点遮罩关闭。

### 2b. `PathPicker` 组件（路径选择器）

`components/command/PathPicker.tsx`（`'use client'`，用前述通用 `Dialog` 承载）：

- 受控开关：`open` / `onOpenChange` / `onSelect(path: string)`。
- 内部状态 `currentPath`（默认 `os.homedir()`，由后端首次返回）。
- UI：
  - 当前路径文本输入（可手动编辑回车跳转）+ **上级** 按钮（用 `parent`）。
  - 目录列表（`entries`）：每项一行，点击进入该子目录。
  - loading / empty / error 状态（路径不存在时显示 error，不关闭弹窗）。
  - **Select** 按钮确认 `currentPath` → `onSelect(currentPath)` 并关闭。
- 数据：`useDirListing(currentPath)` → `client.listDirs(path)`，path 变化时重拉。
- 仅列目录（后端已过滤文件），不可选文件。

`hooks/useDirListing.ts`：`useDirListing(path)` 返回 `{ listing, loading, error, refresh }`。

### 3. `CreateThreadDialogProvider`（全局弹窗）

`CreateThreadDialog` 需从两处触发：HomePage 的 "New thread" CTA 与 `ThreadNavigator` 的 New 按钮。为避免重复管理 open 状态与弹窗实例，采用与 `ConfirmDialogProvider` 一致的全局 provider 模式。

- `stores/createThreadStore.ts`（zustand）：`openCreateThread()` / `closeCreateThread()`。
- `hooks/useCreateThread.ts`：返回 `openCreateThread`。
- `components/command/CreateThreadDialogProvider.tsx`（`'use client'`，root layout 挂载一次）：订阅 store 渲染 `CreateThreadDialog`；`onCreated(thread)` → `closeCreateThread()` + `router.push(\`/threads/${thread.id}\`)`。
- 任意客户端组件：`const openCreateThread = useCreateThread(); openCreateThread();`。

### 4. `HomePage`（首页，取代 `/` 的空态）

`/`（首次进入或未选 thread）不再渲染空的 Command 工作台，改为独立的 **HomePage** 仪表盘。`CommandShell` 只在 `/threads/[threadId]` 渲染（始终有 thread）。

`components/home/HomePage.tsx`（`'use client'`）：
- 数据：`useThreads`（recent）、`useAgents`、`useThreadRuntime`（运行态摘要）、`useWorkspaces`。
- 区块：
  1. **Hero**：TheTower brand + tagline + 一行状态摘要（X agents enabled / Y threads / Z running）+ 主按钮 **New thread**（`openCreateThread()`）。Hero 含原创 Destiny 2 风格动态徽记（见 §4b）。
  2. **Recent threads**：最近 N 条 thread 卡片（title、workspace 短名、mode、最近更新、最新 invocation 状态），点击 → `/threads/[id]`。空态："No threads yet — click New thread"。
  3. **Agents overview**：enabled agent 紧凑列表 + 当前运行态（idle/running 计数）。
  4. **Quick links**：Agents / Telemetry / Workspaces / Tasks / Settings 卡片入口。
- 不渲染 `CommandShell`、不渲染 Composer；这是仪表盘，不是聊天页。
- 动画用 **anime.js** 驱动（见 §4b）：Hero 徽记常驻旋转 + stroke-draw 入场，区块卡片 stagger 入场，hover 辉光脉冲。遵守 `prefers-reduced-motion`（用户关闭动效时降级为静态）。

### 4b. Destiny 2 风格动效（原创资产，anime.js）

**版权约束**：总控文档禁止使用 Destiny 2 原始 Logo / 图标 / 截图 / 受版权素材。以下全部为**原创几何 HUD 动效**，仅借鉴"科幻 HUD / 轨道指挥台 / 扫描线 / 旋转徽记 / 辉光"视觉语言。

新增依赖：`animejs`（v4，ESM named exports：`animate / stagger / utils`）。

**`components/home/DestinyEmblem.tsx`**（`'use client'`，SVG + anime.js）：
- 原创徽记 = 多层几何（外层六边形 / 内层三角 / 中心放射扫描），纯 stroke、`--tower-accent-arc` 能量色 + 少量 `--tower-accent-solar` 强调。
- 动效（anime.js）：
  - 外层六边形顺时针缓慢旋转（~20s linear loop），内层三角形逆时针（~12s）。
  - 入场 stroke-draw：`stroke-dashoffset` 从满到 0，逐层 stagger（线条"绘制"出来，Destiny 2 加载感）。
  - 中心扫描线：一条半径绕中心旋转 + 末端辉光衰减（雷达扫描感）。
  - 整体辉光脉冲：`opacity` / `filter: drop-shadow` 微弱呼吸（120-220ms 区间外的慢呼吸）。
- 可作 Hero 主视觉；也可缩放为 loading spinner 复用（加载/连接中态）。

**HomePage 动效编排**（anime.js）：
- Hero 入场：brand / tagline / 状态摘要 / New thread 按钮 stagger 上移 + 淡入。
- Recent threads / Agents / Quick links 卡片：stagger 淡入 + 轻微位移。
- 卡片 hover：边框能量色 + 微辉光（CSS `:hover` 为主，anime.js 可选增强）。
- `prefers-reduced-motion: reduce` 时：anime.js 不执行，徽记静态、卡片直接显示。

**复用**：`DestinyEmblem` 的"扫描旋转 + stroke-draw"变体可作为全局 loading 指示器（如 SSE connecting、数据 loading）后续复用，本次先用于 HomePage Hero。

### 5. `ThreadNavigator` 的 New 按钮

- 当前 `onNew` → `router.push("/")`。改为 `onNew` → `openCreateThread()`（全局弹窗）。
- `CommandShell` 不再持有 createOpen state；`ThreadNavigator` 通过 `useCreateThread()` 直接触发。

### 6. `CommandComposer` 精简

- 移除 `showWorkspace` / `projectPath` / `onProjectPathChange` / `workspaces` props 与对应的 "Working directory" 输入 + datalist。
- Composer 回归：textarea + Send + send error + mention chips 占位。
- 新 thread 的 workspace 由弹窗决定，不再在 composer 收集。

### 7. `MissionFeed` 调整

- 标题：`thread?.title ?? "New thread"` → 直接 `thread?.title`（CommandShell 现在始终有 thread，MissionFeed 不再处理无 thread 占位）。
- 控制行：移除 "Working directory" 输入 + Save 按钮（`MissionFeed.tsx` 控制行 L135 区域）。保留 **mode 分段控制** 与 Reload。
- 相关 props（`projectPath` / `onProjectPathChange` / `onProjectPathSave` / `workspaces`）从 `MissionFeed` 移除。
- 消息区空态保留："No messages in this thread."（thread 存在但无消息）。

### 8. `CommandShell` 清理

- 移除 `projectPathDraft` state 与 localStorage 逻辑（`the-tower-project-path`），workspace 不再在 composer 收集。
- `handleSend`：不再传 `projectPath`（thread 已在创建时绑定 projectPath）；`postUserMessage({ threadId, content })`。
- 不再渲染 `CreateThreadDialog`（已上移到全局 provider）；`onNew` 交给 `ThreadNavigator` 用 `useCreateThread()`。
- `CommandShell` 现仅由 `/threads/[threadId]` 使用，`threadId` 始终存在。

### 9. 路由调整

- `app/page.tsx`：`<CommandShell />` → `<HomePage />`。
- `app/threads/[threadId]/page.tsx`：保持 `<CommandShell threadId={...} />`。
- `app/layout.tsx`：root layout 增挂 `<CreateThreadDialogProvider />`（与 `ConfirmDialogProvider` 并列）。

## 数据流（目标）

```text
/ （未选 thread）→ HomePage 仪表盘
  点 New thread（或 ThreadNavigator 的 New）→ openCreateThread()
  → CreateThreadDialog(name, path, mode)
  → POST /api/threads → { thread }
  → router.push(/threads/[thread.id])
进入 /threads/[id]（CommandShell，threadId 始终存在）：
  MissionFeed 标题=thread.title，控制行=mode+reload，消息区=消息流
  CommandComposer(textarea) → Send → POST /api/messages({threadId, content})
  → 后端用 thread 已绑定的 projectPath 解析 workspace → 触发 invocation
  → SSE 推送 agent.status / message.created → 实时刷新
```

## 移除清单

- `app/page.tsx` 的 `<CommandShell />`（无 thread 场景）→ 改为 `<HomePage />`。
- `CommandComposer` 的 `showWorkspace` 分支与 "Working directory" 输入。
- `MissionFeed` 控制行的 "Working directory" 输入 + Save。
- `MissionFeed` 标题的 "New thread" 占位。
- `CommandShell` 的 `projectPathDraft` / `the-tower-project-path` localStorage。
- `MissionFeed` / `CommandComposer` 的 `projectPath*` / `workspaces` 相关 props。

## 验收

- 首次进入 `/` 显示 **HomePage 仪表盘**（Hero + New thread CTA + Recent threads + Agents overview + Quick links），不再是空工作台或 "New thread" 占位。
- Hero 含原创 Destiny 2 风格动态徽记（anime.js：旋转 + stroke-draw + 扫描 + 辉光），区块卡片 stagger 入场；`prefers-reduced-motion` 时降级静态。徽记为原创几何，无任何 Destiny 2 版权素材。
- HomePage 与 ThreadNavigator 的 New 都能打开同一个 `CreateThreadDialog`（深色 HUD），含 name / path / mode。
- Workspace path 旁有 **Browse…** 按钮 → 打开 `PathPicker`：可逐级浏览服务器目录、返回上级、手动输入路径；Select 回填 path。
- 弹窗选择 trusted workspace 或经 PathPicker 选定路径 + name → Create → 跳转到 `/threads/[id]`，thread 标题为所填 name，workspace 已绑定。
- 进入新 thread 后，Composer 仅消息输入；Send 后 Agent 在该 workspace 运行，SSE 实时刷新（status / token / 回复）。
- 路径非法时（CreateThread 校验失败 / PathPicker 浏览不存在目录）显示错误，不创建。
- ESC / 点遮罩 / 取消可关闭弹窗，不创建。
- 既有 thread 切换、删除、发送、SSE 实时更新等不回归。
- 颜色门禁（零硬编码）与 lint/build/test 通过。

## 不在本次范围

- 既有 thread 的 workspace **编辑**：本次移除了控制行的内联编辑入口；如需改既有 thread 的 workspace，后续可用同一 Dialog 的"编辑模式"（PATCH /api/threads），本次不做。
- thread 重命名 UI（PATCH title）。
- `ServerEvent` 增加 `thread.created` 事件（Telemetry 列表靠刷新可见，无需事件）。
- HomePage 的可定制卡片 / 拖拽布局。

## 影响文件

- 后端：`packages/api/src/routes.ts`（新增 `POST /api/threads`、`GET /api/dirs`）、`packages/shared/src/index.ts`（`CreateThreadRequest/Response`、`DirEntry`、`DirListResponse`）、`packages/sdk/src/index.ts`（`createThread`、`listDirs`）。
- 前端新增：`components/ui/dialog.tsx`（通用 Dialog）、`components/command/CreateThreadDialog.tsx`、`components/command/PathPicker.tsx`、`components/command/CreateThreadDialogProvider.tsx`、`components/home/HomePage.tsx`、`components/home/DestinyEmblem.tsx`（原创 Destiny 2 风格动效徽记）、`hooks/useDirListing.ts`、`hooks/useCreateThread.ts`、`stores/createThreadStore.ts`。
- 新依赖：`animejs`（v4，HomePage 动效）。
- 前端改动：`app/page.tsx`（`CommandShell` → `HomePage`）、`app/layout.tsx`（挂 `CreateThreadDialogProvider`）、`components/command/ThreadNavigator.tsx`、`components/command/CommandComposer.tsx`、`components/command/MissionFeed.tsx`、`components/command/CommandShell.tsx`。
- 测试：SDK `createThread` / `listDirs` 单测；Playwright smoke 覆盖"`/` HomePage 渲染 + New → Browse → 选目录 → 创建 → 跳转 /threads/[id] + Composer 发消息"。
