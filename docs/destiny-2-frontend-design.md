# TheTower 前端视觉与页面设计方案：Destiny 2 风格

## 目标

当前 `packages/web` 是 React 19 + Vite + Tailwind 4 的调试控制台，核心能力已经覆盖 Agent 配置、Thread 消息、Invocation、SSE 事件、工作目录和私有消息审计。下一阶段前端设计目标不是做营销页，而是把现有调试台升级为一个“多 Agent 指挥台”：用户进入页面后可以立刻选择工作区、观察 Agent、编排任务、审计消息流。

Agent 配置应独立成页面，不应长期塞在主指挥台侧栏里。后续 Agent 可能扩展出可用工具、工具权限、模型参数、运行沙箱、技能绑定、预算限制等配置项，主界面只保留运行状态和少量快捷入口。

“命运2风格”应理解为视觉语言参考，而不是复刻游戏 UI 或使用受版权保护的素材。可借鉴的方向是：轨道指挥台、科幻 HUD、装备/任务卡片、半透明玻璃面板、锐利网格、低饱和深色底、少量高能强调色、清晰的状态反馈。

本方案参考了 `/Users/xuchenyang/ai/clowder-ai` 的产品架构。猫咖前端不是单一聊天 UI，而是一个围绕 chat/workspace/settings/memory/mission/telemetry 的完整操作系统。TheTower 后续也不应只做前端换皮：如果页面需要跨线程观测、工具权限、上下文快照、工作区文件活动和运行审计，就需要同步补齐后端查询和配置接口。

## 当前前端盘点

- 技术栈：`packages/web` 使用 React、TypeScript、Vite、Tailwind 4、`lucide-react`。
- 页面入口：`packages/web/src/App.tsx` 承载几乎全部页面状态、数据请求、布局和局部组件。
- 样式形态：大量 Tailwind class 常量集中在 `App.tsx`，`styles.css` 只定义基础样式。
- 当前布局：顶部 API 状态栏 + 四列工作台，分别是 Agents、Threads、Messages、Invocations/Events。下一版应收敛为主指挥台 + 独立配置/观测页面，避免首页同时承担运行、配置、审计和全局观测。
- 关键数据模型：`Agent`、`Thread`、`Message`、`Invocation`、`Workspace`、`AgentRuntimeStatus`。
- 当前产品定位：README 中写的是“调试前端”，但已经具备升级为正式控制台的基础。

## 猫咖前端参考结论

`/Users/xuchenyang/ai/clowder-ai` 的前端规模明显大于 TheTower，目前可借鉴的不是具体视觉，而是产品分层和工程组织。

### 技术栈差异

- 猫咖使用 Next.js 14 App Router、React 18、Tailwind 3、Zustand、Socket.IO、PWA、IndexedDB 离线快照。
- TheTower 当前使用 Vite、React 19、Tailwind 4、单页 `App.tsx`、SSE 事件流。
- 猫咖通过 `next.config.js` rewrites 把 `/api/*`、`/socket.io/*`、`/uploads/*` 代理到 API；TheTower 当前前端直接维护 `apiBase`。
- 猫咖有 token 化 CSS：`theme-tokens.css`、`console-tokens.css`、`connector-tokens.css`，Tailwind 只暴露 CSS variable alias；TheTower 当前颜色大量散落在 `App.tsx` 常量里。
- 猫咖有自定义 lint 检查硬编码颜色；TheTower 如果要长期维护 Destiny 2 风格，也需要把颜色和形态提升成 token，而不是继续局部字符串拼接。

### 页面结构参考

猫咖的核心页面边界：

- `/`、`/thread/[threadId]`：聊天主工作台。`ChatContainer` 放在 `(chat)/layout.tsx` 中常驻，thread 路由页只放 marker，避免切换 thread 时重挂载消息流、socket 和滚动状态。
- `/settings`：配置治理中心，包含成员、画像、账号、IM、Skill、MCP、插件、市场、语音、系统、规则、通知、运维。
- `/memory/*`：记忆中心，包含 feed、search、status、health、catalog、graph。
- `/mission-hub`：任务和项目调度中心，包含 backlog、外部项目、依赖图、风险、线程态势、SOP。
- `/signals/*`：外部信号和信息源。
- 工作区不是独立静态页面，而是聊天右侧可切换面板，包含文件树、文件查看/编辑、diff、git、terminal、browser preview、schedule、approval、artifact、task board、knowledge/event timeline。

TheTower 不需要一次性复制全部模块，但应采用同一种产品拆分思路：主工作台只承载当前任务，配置、观测、工作区、任务和记忆各自成为一等页面或一等面板。

### 可借鉴的工程模式

- 常驻 Shell：Activity/Nav、Thread Sidebar、核心 Chat/Command 容器、浮动面板应尽量常驻，路由变化只改变当前上下文。
- URL 是 thread source of truth：threadId 来自路由，store 跟随路由，而不是完全依赖局部 selected state。
- Thread-scoped state：消息、active invocation、queue、workspace tabs、draft、unread 都应按 thread 存储，避免跨线程串状态。
- 后端 truth + 前端快照：实时事件可能丢失，前端要能通过 `/queue`、`/threads/:id/context`、`/telemetry` 重新对齐。
- 配置治理独立：Agent 配置、工具权限、MCP、模型账号、运行策略不应塞进聊天页。
- 富消息协议：普通 markdown 不够，长期需要结构化 rich block，例如 card、diff、checklist、file、interactive、tool event、handoff、context snapshot。

## 设计原则

1. 信息密度优先
   TheTower 是多 Agent 调度工具，页面应像任务指挥台，而不是宣传官网。保留多列、状态条、事件流、审计过滤等高密度信息结构。

2. 深色沉浸但不牺牲可读性
   主背景使用深空色和冷灰色，面板使用半透明或低对比深色。正文文本保持高对比，日志、ID、状态、路径使用等宽或窄字重。

3. 任务状态必须一眼可见
   Agent 的 thinking、tool_calling、replying、done、error 等状态要有明确颜色、图标和运动反馈。不要只依赖文字。

4. 面板像系统模块，不像普通卡片堆叠
   使用细边框、角标、扫描线、分区标题、网格背景和锐利间距。卡片只用于 Agent、Thread、Invocation 这类重复对象。

5. 游戏感来自交互节奏和视觉层次
   适度使用 hover 高亮、选中边框、状态脉冲、进度条、分段控制。避免大面积紫蓝渐变、装饰光球或过度拟物。

## 视觉风格说明

### 关键词

- 深空控制台
- 轨道任务板
- 科幻 HUD
- 装备卡片
- 雷达/扫描线
- 阵营式 Agent 身份
- 高亮边框和能量色

### 色彩系统

建议用设计 token 管理，不在 JSX 中继续散落硬编码颜色。

```text
background.base      #080b10  页面主背景
background.elevated  #101722  一级面板
background.panel     #141d2a  面板主体
background.hover     #1c2838  悬浮态

border.subtle        #273447  普通边框
border.strong        #516178  激活边框
border.energy        #8fb9ff  高亮边框

text.primary         #eef4ff  主文本
text.secondary       #a8b3c3  次级文本
text.muted           #6f7c8f  弱文本

accent.arc           #8fb9ff  冷蓝：选中、链接、SSE
accent.solar         #f5b95b  金橙：告警、工具调用
accent.void          #b39cff  紫色：私有消息、审计
accent.strand        #59d69f  绿色：完成、健康
accent.danger        #ff6473  错误、删除、失败
```

注意：紫色只能作为辅助状态色，不能让页面整体变成紫蓝渐变主题。

### 字体与排版

- 主字体：继续使用系统 sans-serif，保证中英文可读性。
- 数字、ID、日志、路径：建议增加 `font-mono` token，用于 Invocation ID、事件 JSON、路径。
- 标题：短、硬朗、全大写或小型大写，例如 `AGENTS`、`THREADS`、`MISSION FEED`。
- 字号：控制台类页面以 12-14px 为主体，页面标题 18-22px，避免大号 hero 字体。

### 形状与质感

- 圆角：从当前 `rounded-lg` 收紧到 4-6px；按钮和输入框 4px；重复卡片 6px。
- 边框：1px 冷灰边框，选中时使用 `accent.arc` 或 `accent.solar`。
- 背景：深色面板 + 轻微网格纹理 + 局部透明，不使用大块渐变球。
- 角标：关键面板可使用 `::before` 做短线角标，增强 HUD 感。
- 动效：状态点脉冲、SSE 连接流动条、Invocation 运行进度光带，持续时间 120-220ms。

## 是否使用组件库

建议使用 shadcn/ui 作为长期 UI primitives 方案，但不引入 Ant Design、MUI、Chakra 这类强视觉大型组件库。

理由：

- TheTower 后续会有 Command、Agents、Telemetry、Workspace、Tasks、Settings 多个复杂页面，完全手写基础控件会逐渐失控。
- shadcn/ui 基于 Radix UI + Tailwind，组件代码进入本仓库，可改、可删、可按 TheTower 风格重塑，不会像传统组件库一样被默认视觉绑死。
- Dialog、Popover、Tabs、Tooltip、Dropdown、Select、Switch、Checkbox、Command、Toast、Sheet、Resizable 等交互控件需要稳定的无障碍和键盘行为，shadcn/ui 比手写更稳。
- “命运2风格”依赖强视觉定制，通用组件库默认主题会削弱一致性。
- 项目已经使用 Tailwind 4 和 `lucide-react`，shadcn/ui 与这两者匹配，能自然接入图标和 token。

推荐方案：

- 保留 Tailwind 4 + React。
- 保留 `lucide-react`，继续用于按钮、状态和工具图标。
- 引入 shadcn/ui，并把组件生成到 `packages/web/src/components/ui/`。
- shadcn/ui 只作为结构和交互基础，视觉必须绑定 TheTower 自己的 CSS variables，不直接沿用默认 neutral/slate 主题。
- 新增本地 UI primitives 和业务组件：
  - `Shell`
  - `HudPanel`
  - `PanelHeader`
  - `IconButton`
  - `StatusBadge`
  - `SegmentedControl`
  - `CommandInput`
  - `AgentStatusCard`
  - `AgentConfigForm`
  - `ToolPermissionMatrix`
  - `ThreadListItem`
  - `MessageBubble`
  - `InvocationCard`

适合直接采用 shadcn/ui 的组件：

- `button`、`input`、`textarea`、`select`、`switch`、`checkbox`
- `tabs`、`dialog`、`sheet`、`popover`、`tooltip`、`dropdown-menu`
- `command`：用于 Agent mention、command palette、路径/工具快速选择。
- `toast`：用于保存、发送、API/SSE 错误。
- `resizable`：用于 Command 主区、Workspace、Telemetry 多栏布局。
- `table`：用于 Tool Audit、Invocation Feed、Workspace Activity。

需要自定义而不是照搬 shadcn 默认外观的组件：

- `HudPanel`：需要 Destiny 2 风格边框、角标、能量色，不应只是普通 card。
- `AgentStatusCard`：像装备卡，包含身份色、状态、token、工具。
- `MessageBubble`：需要 public/private/callback/handoff/stream 多态。
- `ThreadTimeline`、`InvocationFeed`、`ThreadContextPanel`：需要信息密度和审计语义，不能只用默认 table/card。

实施约束：

- shadcn/ui 组件必须通过 CSS variables 接入 `--tower-*` token。
- 禁止在业务 JSX 中继续散落 hex color；颜色走 token 或组件 variant。
- 默认 rounded、shadow、background 要调整成 TheTower HUD 风格：4-6px 圆角、细边框、少阴影、深色面板、明确状态色。
- 引入 shadcn/ui 不等于使用现成主题；视觉规范仍以本文件的 Destiny 2 风格为准。

## 产品模块规划

基于猫咖分析，TheTower 的产品面应分为以下模块。Figma 当前三页只是第一版骨架，后续应扩展到这些能力面。

### Command

当前任务指挥台，对应猫咖的 chat workspace，但保留 TheTower 的多 Agent 调度定位。

- Thread 选择和创建。
- 当前 thread 的消息流、handoff、private/revealed、callback、agent stream。
- Agent runtime strip：当前任务链路、活跃 Agent、当前工具、token/context 使用。
- Command Composer：mention、快捷 chips、工作目录提示、发送状态、错误恢复。
- 轻量入口：Open Telemetry、Configure Agents、Open Workspace。
- 不承载完整 Agent 配置，不承载全局 Invocations/Events，不承载长期工具审计。

### Agents

Agent 配置治理中心。

- Agent 名册、启用状态、provider、model、mention handles、身份色。
- Persona：role、personality、strengths、restrictions、background、voice、signature。
- Model：provider 参数、上下文窗口、预算、fallback、pricing/cost 显示。
- Tools：可用工具、MCP server、读写权限、危险操作、继承/覆盖策略。
- Runtime：cwd policy、sandbox、approval、timeout、并发、token budget。
- Audit：配置变更、最近失败、工具拒绝、callback auth 健康。

### Telemetry

跨线程观测和审计中心。

- Thread Timeline：所有 thread 的运行状态、workspace、活跃 Agent、最后事件、错误数。
- Invocation Feed：跨 thread 查询 invocation，支持 status、agent、route mode、时间范围过滤。
- Event Feed：持久化事件查询，不能只依赖前端 SSE 内存。
- Tool Audit：文件读写、shell、MCP、callback、denied reason、bytes、path、agent、invocation。
- Thread Context：每个 thread 当前上下文快照，包括消息窗口、private 可见性、worklist、workspace fingerprint、最近文件访问。

### Workspace

工作区和代码上下文面。第一版可简单，后续应接近猫咖 WorkspacePanel 的能力边界。

- Trusted workspaces、projectPath、最近打开、workspace fingerprint。
- 文件活动：最近 read/write/list、denied、文件变更摘要。
- 代码浏览：文件树、只读文件查看、搜索。
- 后续扩展：diff、git 状态、terminal、browser preview、artifact、task board。
- 与 Command 联动：当前 thread 绑定 workspace，Agent 工具访问在 Workspace 和 Telemetry 中都可追踪。

### Tasks / Mission

任务和多 Agent 编排面。TheTower 当前已有 thread/message/invocation，但缺少“任务对象”。

- Backlog 或 task card：title、summary、priority、status、tags、owner Agent。
- 从任务创建 thread。
- 显示任务到 thread/invocation 的映射。
- 后续支持 dispatch、review、risk、dependency graph、SOP。

### Memory / Context

不要求立即实现长期记忆，但上下文和证据面要提前留出口。

- Thread context snapshot 是第一步。
- 后续扩展 evidence search、summary、collection/catalog、context builder health。
- 与 Telemetry 共享：展示“Agent 实际看到了什么”，包括被裁剪内容和 token 估算。

### Settings / Ops

系统级配置和运维面。

- API base、服务健康、SSE/Socket 状态。
- Provider credentials 状态，不直接暴露 secret。
- MCP server 状态、工具目录、安装/禁用。
- 环境变量摘要、runner 配置、storage/db 状态。
- 日志/导出/诊断入口。

## 整体页面设计

### 主界面：Tower Command

第一屏就是可用工作台，不做 landing page。

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Top Command Bar                                                            │
│ TheTower / workspace / API-SSE / refresh / global actions                   │
├───────────────┬─────────────────────┬──────────────────────────────────────┤
│ Agent Roster  │ Thread Navigator    │ Mission Feed                         │
│               │                     │                                      │
│ status cards  │ thread list         │ audit filters                        │
│ active tools  │ workspace labels    │ runtime status bar                   │
│ token usage   │ mode badges         │ message stream                       │
│ config links  │ new/delete          │ command composer                     │
└───────────────┴─────────────────────┴──────────────────────────────────────┘
```

首页不放 Invocations 和 Events 卡片。它们是全局观测和审计信息，不应挤占当前 thread 的对话与编排空间。首页只显示当前 thread 必须的轻量运行状态，例如 Agent runtime status bar 和必要错误提示；详细 invocation、event、工具调用和上下文快照进入独立 Telemetry 页面。

### 顶部 Command Bar

当前 header 可升级为一条深色指挥栏：

- 左侧：TheTower 标识、当前 workspace 名称、当前 thread title。
- 中间：API Base 输入折叠为设置入口，默认只显示连接目标。
- 右侧：API health、SSE 状态、刷新按钮、设置按钮。
- 状态表现：
  - API + SSE 正常：绿色细线和 `Wifi` 图标。
  - SSE 断开：金橙警告。
  - API 错误：红色阻断状态。

### Agent Roster

对应现有 Agents 列，但它应从“配置表单”转为“运行状态侧栏”。

设计方向：

- Agent 卡片像装备卡，包含名称、mention handle、provider、model、enabled、当前 runtime 状态、最近工具调用和 token 概况。
- 每个 Agent 有一条“身份色”或“阵营色”，用于消息气泡、状态条和 Thread 中的 mention。
- 主界面不承载 persona 长表单编辑，只提供 `Configure` 入口跳转到 Agent 配置页。
- enabled 可以提供快捷 toggle，但复杂配置必须进入独立页面完成。
- 卡片摘要只展示运行决策需要的信息：Role 摘要、Provider、Model、Status、Token、当前工具、是否启用。

### Agent Configuration

Agent 配置应作为独立页面或一等视图，路径建议为 `/agents` 和 `/agents/:agentId`。这个页面面向“配置和治理”，不是运行监控。

页面结构建议：

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Agent Configuration Header                                                  │
│ search / create agent / import-export / save status                         │
├──────────────────────┬─────────────────────────────────────────────────────┤
│ Agent List           │ Agent Detail                                         │
│ name / provider      │ tabs: Overview / Persona / Model / Tools / Runtime   │
│ enabled / status     │                                                     │
└──────────────────────┴─────────────────────────────────────────────────────┘
```

详情页 tab 建议：

- `Overview`：displayName、mentionHandles、enabled、provider、model、身份色、摘要说明。
- `Persona`：roleDescription、personality、strengths、restrictions、background、voice、quirks、signature。
- `Model`：provider 专属模型参数，后续可放 temperature、max tokens、reasoning effort、fallback model。
- `Tools`：可用工具配置、工具权限、读写权限、危险操作开关、MCP server 绑定。
- `Runtime`：工作目录策略、沙箱策略、超时、预算、token 限制、并发限制。
- `Audit`：最近配置变更、最近运行错误、工具拒绝记录。

第一版可以只实现 `Overview`、`Persona`、`Tools` 三个 tab 的外壳，其中 `Tools` 先作为预留空态或只读占位，避免后续再重构信息架构。

### Thread Navigator

对应现有 Threads 列。

设计方向：

- Thread 列表像任务列表，每项显示：
  - 标题
  - workspace 短名
  - mode：debug / play
  - 更新时间
  - 最后一次 invocation 状态
- 新建 thread 时，工作目录选择应更突出，因为它决定 Agent 能访问的项目上下文。
- 删除动作只在 hover 或选中时显示，保持当前设计思路。

### Mission Feed

对应现有消息主列，是页面核心。

结构建议：

- 顶部：Thread 标题、mode 分段控制、working directory、reload。
- 第二层：Audit filter，用分段控制替代普通按钮组。
- 第三层：Agent runtime status bar，显示当前任务链路。
- 主体：消息流。
- 底部：Command Composer。

消息样式：

- 用户消息：右侧，冷蓝边框，发送者显示为 `Guardian` 可以保留。
- Agent 消息：左侧，使用 Agent 身份色。
- System 消息：居中窄条，低对比。
- Private 消息：虚线边框 + `accent.void`，默认折叠敏感细节，可 reveal。
- Handoff payload：用结构化情报卡展示 `what / why / tradeoff / nextAction`，不要只放 details。
- Agent stream：保留折叠，但改名为 `CLI TELEMETRY` 或 `STREAM OUTPUT`。

Command Composer：

- 输入框像命令终端，但仍是 textarea。
- Send 按钮使用图标 + 短文本。
- 可预留快捷 chips：`@agent-a`、`@agent-b`、`review`、`handoff`。

### Telemetry & Context

Invocations 和 Events 应作为独立页面或一等视图，路径建议为 `/telemetry`。这个页面不只看当前 thread，而是按所有 thread 聚合运行观测信息，并补上每个 thread 的当前上下文。

页面结构建议：

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Telemetry Header                                                            │
│ filters: thread / agent / status / event type / workspace / time range       │
├──────────────────────┬──────────────────────────┬──────────────────────────┤
│ Thread Timeline      │ Invocation & Event Feed   │ Thread Context           │
│ all threads          │ selected thread/details   │ selected thread snapshot │
│ status summary       │ tool calls / json expand  │ messages / workspace     │
└──────────────────────┴──────────────────────────┴──────────────────────────┘
```

核心模块：

- `Thread Timeline`：按 thread 聚合展示最新状态、workspace、当前/最近 invocation、活跃 Agent、错误数、最后事件时间。
- `Invocation Feed`：展示所选 thread 或全部 thread 的 invocation timeline，包含 short id、status、route mode、target agents、started、finished、duration。
- `Event Feed`：展示 SSE 事件，默认是格式化事件行，点击后展开 JSON。支持按 event type、agent、invocation、thread 过滤。
- `Tool Audit`：重点展示 `workspace.file_tool` 和后续工具调用事件，包含 path、tool、bytes、denied、reason、agent、invocation。
- `Thread Context`：展示每个 thread 的当前上下文快照，帮助判断 Agent 实际看到了什么。

`Thread Context` 应至少包含：

- thread title、mode、projectPath、workspace fingerprint。
- 当前消息窗口摘要：最近 N 条消息、public/private/revealed 计数、handoff 数量。
- 当前 invocation 上下文：root message、target agents、route mode、depth、worklist。
- 当前 Agent 可见性：哪些 private message 对哪些 Agent 可见。
- 当前工作目录与最近文件工具访问记录。
- 如果后端后续提供 context builder 输出，应展示“实际发送给 Agent 的上下文包”，包括裁剪原因、token 估算和被省略内容摘要。

首页可以保留一个轻量入口，例如 Command Bar 中的 `Telemetry` 按钮，或当前 thread 标题旁的 `Open telemetry` 图标，点击后进入 `/telemetry?threadId=...`。

## 页面拆分

当前主指挥台可以继续保持单页，但 Agent 配置、Telemetry 观测、Workspace、Tasks/Mission、Settings/Ops 都应作为独立页面规划。实现上可以先用本地 view state，正式化后再迁移到路由。

### 第一阶段：单页 Shell 内拆组件

保持一个页面，先拆出组件和样式 token：

```text
packages/web/src/
  App.tsx
  styles.css
  design/
    tokens.ts
    classNames.ts
  components/
    AppShell.tsx
    ActivityNav.tsx
    Shell.tsx
    TopCommandBar.tsx
    HudPanel.tsx
    StatusBadge.tsx
    SegmentedControl.tsx
    AgentRoster.tsx
    AgentStatusCard.tsx
    ThreadNavigator.tsx
    ThreadListItem.tsx
    MissionFeed.tsx
    MessageBubble.tsx
    CommandComposer.tsx
    WorkspaceSummaryPanel.tsx
    TaskCard.tsx
  pages/
    CommandPage.tsx
    AgentsPage.tsx
    AgentDetailPanel.tsx
    AgentPersonaTab.tsx
    AgentToolsTab.tsx
    AgentRuntimeTab.tsx
    TelemetryPage.tsx
    ThreadTimeline.tsx
    InvocationFeed.tsx
    EventFeed.tsx
    ToolAudit.tsx
    ThreadContextPanel.tsx
    WorkspacePage.tsx
    TasksPage.tsx
    SettingsPage.tsx
  stores/
    appStore.ts
    threadStore.ts
    telemetryStore.ts
    agentConfigStore.ts
    workspaceStore.ts
  hooks/
    useTowerClient.ts
    useEventStream.ts
    useThreadRuntime.ts
    useTelemetry.ts
    useThreadContext.ts
    useWorkspaceActivity.ts
```

### 第二阶段：增加视图切换

仍然可以不引入 React Router，用本地 state 控制：

- `Command`：当前主工作台，只展示 Agent 运行状态和配置入口。
- `Agents`：独立 Agent 配置页，承载 persona、模型、工具、运行时等配置。
- `Telemetry`：独立观测页，跨线程展示 Invocation、Events、工具调用审计和各 thread 当前上下文。
- `Workspaces`：可信工作区、路径、最近使用记录。
- `Tasks`：任务/backlog、thread 绑定、dispatch 状态和风险。
- `Settings`：系统配置、provider、MCP、服务健康、运维诊断。

### 第三阶段：正式路由

当功能超过单页后再引入路由：

```text
/
/threads/:threadId
/agents
/agents/:agentId
/telemetry
/telemetry/:threadId
/workspaces
/workspaces/:workspaceId
/tasks
/tasks/:taskId
/settings
```

如果先不上 React Router，也要按这些页面边界组织代码，避免把 Agent 配置继续堆进 `App.tsx`。

如果后续从 Vite 迁移到 Next.js，应采用猫咖的常驻 layout 模式：`CommandShell` 常驻，`/threads/:threadId` 页面只改变 route marker 和当前 thread id，避免消息流、事件订阅、滚动位置和 thread-scoped state 反复重置。

## 组件拆分建议

### 数据容器

短期内 `App.tsx` 可以保留数据请求和全局状态，但不应继续增长。页面拆分后应把状态按领域拆开：

- `appStore`：apiBase、health、streamStatus、activePage、global errors。
- `threadStore`：threads、currentThreadId、threadStates、drafts、unread、selected filters。
- `agentStore`：agents、runtime statuses、config dirty state、tool permissions。
- `telemetryStore`：thread summaries、invocations、events、tool audit rows、filters。
- `workspaceStore`：trusted workspaces、current workspace、recent file activity、workspace fingerprints。

后续如果状态继续膨胀，再抽：

- `useTowerClient`
- `useEventStream`
- `useAgents`
- `useThreads`
- `useThreadMessages`
- `useTelemetry`
- `useThreadContext`
- `useWorkspaceActivity`
- `useAgentConfig`
- `useTaskBoard`

### 展示组件

优先把 JSX 和样式从 `App.tsx` 拆出去：

- `TopCommandBar`：API、SSE、刷新、错误状态入口。
- `AgentRoster`：主工作台中的 Agent 运行状态容器。
- `AgentStatusCard`：单个 Agent 的状态摘要和配置入口。
- `AgentsPage`：独立 Agent 配置页面。
- `AgentDetailPanel`：单个 Agent 的配置详情容器。
- `AgentPersonaTab`：人格配置表单。
- `AgentToolsTab`：可用工具和权限配置。
- `AgentRuntimeTab`：沙箱、预算、超时等运行配置。
- `ThreadNavigator`：Thread 列表和新建入口。
- `MissionFeed`：Thread 顶部控制、审计过滤、消息流、输入区。
- `MessageBubble`：消息呈现、private reveal、handoff payload。
- `TelemetryPage`：独立观测页面容器。
- `ThreadTimeline`：跨线程状态列表和时间线。
- `InvocationFeed`：Invocation 列表、状态、耗时和目标 Agent。
- `EventFeed`：格式化事件流和 JSON 展开。
- `ToolAudit`：工具调用和文件访问审计。
- `ThreadContextPanel`：所选 thread 的当前上下文快照。
- `WorkspacePage`：工作区列表、workspace 详情和文件活动。
- `WorkspaceActivityPanel`：最近文件工具访问、denied reason、path、bytes。
- `TasksPage`：任务/backlog 总览。
- `TaskDetailPanel`：任务到 thread/invocation 的映射。
- `SettingsPage`：系统配置和运维入口。

## 后端接口调整建议

猫咖复杂页面能成立，是因为后端提供了面向产品页的查询接口，而不是只依赖实时事件。TheTower 若要实现上述设计，需要增加以下 API。优先级按页面落地顺序排列。

### Telemetry 查询接口

```text
GET /api/telemetry/threads
GET /api/invocations?threadId=&agentId=&status=&from=&to=
GET /api/events?threadId=&invocationId=&agentId=&type=&from=&to=
GET /api/tool-audit?threadId=&agentId=&tool=&denied=&from=&to=
```

用途：

- 支持 Telemetry 页面刷新、过滤、深链。
- 避免前端只能看最近 40 条 SSE 内存事件。
- 让 invocation/event/tool audit 能跨 thread 查询。

### Thread Context 接口

```text
GET /api/threads/:threadId/context
GET /api/threads/:threadId/context-package/:invocationId
```

返回建议：

- thread 基本信息：title、mode、projectPath、workspaceFingerprint。
- message window：最近 N 条消息、public/private/revealed/handoff 计数。
- visibility map：private message 对哪些 Agent 可见。
- invocation context：rootMessageId、targetAgents、routeMode、depth、worklist。
- workspace context：workingDirectory、最近文件访问、denied records。
- context builder 输出：included messages、omitted ranges、truncation reasons、estimated tokens。

### Agent 配置接口

```text
GET /api/agents/:id/config
PATCH /api/agents/:id/config
GET /api/agents/:id/tools
PATCH /api/agents/:id/tools
GET /api/agents/:id/runtime
PATCH /api/agents/:id/runtime
GET /api/agents/:id/audit
```

需要把现有 `Agent` 拆成更明确的配置域：

- identity/persona。
- provider/model。
- tool permission policy。
- runtime policy。
- audit metadata。

### Workspace 接口

```text
GET /api/workspaces
GET /api/workspaces/:id
GET /api/workspaces/:id/activity
GET /api/workspaces/:id/files?path=
GET /api/workspaces/:id/search?q=
```

第一版只需要支持 workspace 列表和工具访问活动。文件树、搜索、diff、git 可以后续扩展。

### Tasks / Mission 接口

```text
GET /api/tasks
POST /api/tasks
GET /api/tasks/:id
PATCH /api/tasks/:id
POST /api/tasks/:id/create-thread
GET /api/tasks/:id/threads
```

第一版可以把 task 当作 thread 的上层组织对象，不必立即实现完整 backlog/mission control。

### 实时事件调整

当前 SSE 可以继续使用，但事件需要可持久化、可重放、可查询。建议：

- 保留 `/api/events` SSE 作为 live channel。
- 增加事件表或事件日志，用于 `GET /api/events` 查询。
- 每个事件包含 `eventId`、`seq`、`threadId`、`invocationId`、`agentId`、`type`、`createdAt`。
- 前端用 `lastEventId/seq` 做 reconnect catch-up。
- 如果后续需要双向控制、队列重排、审批，可以考虑 Socket.IO；第一阶段不强制迁移。

## 响应式布局

当前 `body` 设置了 `min-width: 1120px`，适合桌面调试台，但后续可以增强：

- `>= 1440px`：首页三列完整布局；Telemetry 页面三栏完整布局。
- `1280px - 1439px`：首页保持三列；Telemetry 页面把 Context 作为右侧可折叠面板。
- `1024px - 1279px`：Agents 和 Threads 合并为左侧 tab。
- `< 1024px`：不追求完整移动体验，改为“只读监控模式”：Thread 列表 + Mission Feed + Composer。

TheTower 这种工具型产品应优先保证桌面体验。

## 交互状态

必须设计并实现以下状态：

- API checking / ok / error
- SSE connecting / connected / error
- Agent idle / thinking / tool_calling / replying / done / error / suspected_stall
- Thread selected / hover / empty
- Message public / private / revealed / callback / handoff / stream
- Invocation queued / running / done / failed / cancelled
- Thread context loading / available / stale / unavailable
- Command Composer empty / typing / sending / disabled
- Agent config idle / dirty / saving / saved / error
- Agent tools enabled / disabled / denied / inherited

## 实施计划

### Phase 1：Token、Shell 与页面边界

- 在 `styles.css` 中建立深色主题基础变量，避免颜色继续散落在 JSX 中。
- 增加 `theme-tokens.css` / `console-tokens.css` 式分层：foundation token、semantic token、component alias。
- 新增 `HudPanel`、`TopCommandBar`、`StatusBadge`。
- 把当前白色四列布局改为深色三列主指挥台，并为独立观测页预留导航入口。
- 不改变 API 行为和数据请求。

### Phase 2：Command 首页重做

- 拆 `AgentRoster`、`ThreadNavigator`、`MissionFeed`。
- 将主工作台 Agent 卡片改为状态卡，不再承载完整配置表单。
- 重做 Thread item。
- 把审计过滤改为分段控制。
- 把 MessageBubble 调整为 Destiny 2 风格的信息卡。
- 为当前 thread 增加 `Open Telemetry`、`Open Workspace`、`Configure Agents` 入口。

### Phase 3：Agent 配置页

- 新增 Agents 独立视图或 `/agents` 页面。
- 将 persona、provider、model、enabled 等编辑能力从主工作台迁移到 Agent 配置页。
- 预留 Tools tab，用于后续配置可用工具、工具权限、MCP server 绑定和危险操作开关。
- Agent 状态卡的 `Configure` 入口跳转或切换到对应 Agent 详情。
- 后端补 `GET/PATCH /api/agents/:id/config`、`/tools`、`/runtime`。

### Phase 4：Telemetry 查询与上下文页

- 新增 `/telemetry` 或 Telemetry 独立视图。
- 从首页移除 Invocations 和 Events 卡片。
- 按所有 thread 聚合 invocation、event、工具调用审计信息。
- 增加 `Thread Context` 面板，展示所选 thread 的当前上下文、消息窗口、可见性、workspace 和最近工具访问。
- 支持从首页当前 thread 直接跳转到对应 telemetry 过滤视图。
- 后端补 `GET /api/telemetry/threads`、`GET /api/events`、`GET /api/tool-audit`、`GET /api/threads/:id/context`。

### Phase 5：Workspace 与工具活动

- 新增 `/workspaces` 页面。
- 展示 trusted workspaces、当前绑定 thread、workspace fingerprint。
- 展示最近文件工具访问和 denied records。
- 第一版只读；后续再做文件树、搜索、diff、git、terminal、browser preview。
- 后端补 `GET /api/workspaces/:id/activity`。

### Phase 6：Tasks / Mission

- 新增 `/tasks` 页面，把 thread 组织到任务对象下。
- 支持从 task 创建 thread，展示 task -> thread -> invocation 的关系。
- 后续扩展 dispatch、risk、dependency、SOP。
- 后端补 task CRUD 和 task-thread 绑定接口。

### Phase 7：交互和审计增强

- Handoff payload 改为结构化情报卡。
- Events 在 Telemetry 页面默认格式化，展开后才显示 JSON。
- Agent runtime status bar 增加运行态动效和 token/工具状态。
- Composer 增加 mention chips 和发送中状态。
- 引入 rich block 协议，支持 card、diff、checklist、file、interactive、tool event。

### Phase 8：路由与常驻 Shell

- 增加 Command / Agents / Telemetry / Workspaces / Tasks / Settings 视图切换。
- Telemetry 视图支持过滤 thread、invocation、agent、event type、workspace 和时间范围。
- 评估从 Vite 单页迁移到 React Router 或 Next App Router。
- 无论是否迁移 Next，都应实现常驻 Shell 和 thread-scoped state，避免 thread 切换重挂载核心工作台。

## 不建议做的事

- 不建议一开始引入 Ant Design、MUI、Chakra 这类完整组件库。
- 不建议做 landing page 或 hero 页面。
- 不建议使用命运2原始图标、Logo、截图或受版权保护素材。
- 不建议把页面做成大面积紫蓝渐变。
- 不建议在当前阶段引入复杂路由和全局状态库。
- 不建议为了视觉效果降低消息、事件、错误状态的可读性。
- 不建议只做 Figma/前端静态页而不补后端查询接口；Telemetry、Context、Tools、Workspace 都需要后端产品化 API。
- 不建议把所有功能都塞进 Command 首页；首页只服务当前任务编排。

## 最小可落地版本

如果只做第一版产品升级，建议范围控制为：

1. 新增深色设计 token，重做 Command 首页视觉。
2. 拆出 Command / Agents / Telemetry 三个页面边界，即使暂时仍用本地 view state。
3. Agent 主侧栏改成状态卡，完整配置迁移到 Agents 页面。
4. 首页移除 Invocations / Events 右侧卡片，只保留进入 Telemetry 的入口。
5. Telemetry 页面第一版接入现有 invocation/messages/runtime status，同时定义后端查询接口。
6. 新增 `GET /api/threads/:id/context` 的最小版本：thread 基本信息、消息计数、visibility、当前 invocation、最近 workspace 文件工具访问。
7. 新增 `GET /api/events` 或事件持久化方案，避免 Telemetry 依赖前端 SSE 临时数组。
8. 路由可以暂缓，但代码结构必须先按页面和 store 边界拆。

这样可以在较小风险下把页面从“普通调试后台”推进到“科幻多 Agent 指挥台 + 配置治理 + 观测上下文”的产品雏形，同时为后续 Workspace、Tasks/Mission、Memory/Context 留出清晰接口。
