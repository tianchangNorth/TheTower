# AI 输出 Markdown 渲染方案

> 文档状态：Superseded（历史前端实施方案）
> 当前来源：[前端页面说明](../frontend/frontend-pages-guide.md)、[能力矩阵](./capability-matrix.md)
> 保留目的：记录 Markdown 渲染方案形成过程，不代表当前组件结构或发布状态。

参考项目：Cat Cafe / Clowder AI（`/Users/xuchenyang/ai/clowder-ai`）

生成时间：2026-07-02

## 1. 背景

TheTower 聊天页面当前完全没有对 AI 输出做 Markdown 渲染。`MessageBubble` 中 agent 文本走的是：

```tsx
<p className="m-0 wrap-anywhere whitespace-pre-wrap text-[13px] text-tower-text-primary">
  {message.content}
</p>
```

仅保留换行与空白，粗体、列表、代码块、链接、表格全部不渲染。`StreamOutput` 用 `<pre className="whitespace-pre-wrap">` 逐 chunk 显示，telemetry 视图 `RawMessageRow` 同样是 `<pre>` 纯文本。全仓没有任何 markdown 解析依赖。

Cat Cafe 的 AI 输出渲染分两层：

1. **标准 Markdown 文本** → `MarkdownContent`（react-markdown）渲染，带组件覆盖（mentions、文件路径链接、代码块复制按钮、mermaid）。
2. **非标准富文本块** → `RichBlocks` 调度器，按 `block.kind` 分发到独立 React 组件（card / diff / checklist / interactive / html_widget / file / audio / media_gallery），这些是 AI 通过 `message.extra.rich.blocks` 下发的结构化 JSON 块，不走 markdown 解析。

本方案结合 TheTower 现状（Tailwind v4 + 严格 token lint + SSE 全量重拉）与 Cat Cafe 渲染层架构，给出分阶段落地方案。**只讨论展示层**，不改动 `Message` 数据模型（`content` 已经是适合 md 解析的字符串）。

## 2. 现状对比

| 维度 | TheTower 现状 | Cat Cafe 做法 |
|---|---|---|
| md 渲染 | 无，`<p className="whitespace-pre-wrap">{content}</p>` | react-markdown + remark-gfm + remark-breaks |
| 代码块 | 无 | CodeBlock 复制按钮，无语法高亮，mermaid 拦截 |
| 流式 | SSE 全量重拉（非 delta 拼接），chunk 在 `StreamOutput` 里按段 `<pre>` | store 层单次 `set()` 批量更新，渲染层无节流 |
| 富文本 | 无 | `extra.rich.blocks` JSON 协议 + RichBlocks 调度器（8 种块） |
| 内联增强 | mention 仅在 footer 列 handle，content 里 `@handle` 纯文本 | @mention pill + 文件路径链接化 + textProcessor 扩展点 |
| 安全 | 无需求（纯文本） | DOMPurify（mermaid SVG + iframe widget），react-markdown 默认不透传 raw HTML |
| 样式 | Tailwind v4 + 三层 token，无 prose，hex 有 lint | Tailwind v3 手写每组件类，无 prose，CSS 变量 |

关键差异：TheTower 是 Tailwind v4 + 严格 token lint + 全量重拉，Cat Cafe 是 v3 + 手写 + 增量批量更新。渲染层架构可复用，但不能照搬。

## 3. Cat Cafe 能力调研

### 3.1 依赖与版本

`packages/web/package.json`：

- `react-markdown` `^10.1.0`（主渲染器，基于 unified/remark）
- `remark-gfm` `^4.0.1`（GFM：表格、删除线、任务列表、自动链接）
- `remark-breaks` `^4.0.0`（软换行 → `<br>`，不要求两空格）
- `mermaid` `^11.15.0`（图表，动态 import）
- `dompurify` `^3.3.3`（SVG / widget 清洗）

未使用：remark-math / rehype-katex / rehype-raw / rehype-sanitize / shiki / highlight.js / prism / refractor。即没有数学公式渲染、没有代码语法高亮、没有 raw HTML 透传。

### 3.2 渲染管线

入口 `packages/web/src/components/MarkdownContent.tsx`：

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkBreaks]}
  components={buildMdComponents(textProcessor?)}
/>
```

`buildMdComponents` 是工厂函数，返回 `Components` 映射。每个文本类组件（p/strong/em/del/h1-h6/li/a/th/td）都套上 `m` 或 `ml` 文本处理组合函数，组合顺序为 `textProcessor → withMentions/withMentionsAndLinks`。`pre`/`code` 故意排除 textProcessor（保护代码块内容）。`textProcessor` prop 是公开扩展点，唯一实际使用是 `ConciergeMessageContent`（在文本中注入内联按钮）。

### 3.3 代码块能力

`CodeBlock`（第 58-87 行）：

- 复制按钮：右上角 "复制/已复制"，1.5s 复位，桌面端 hover 显示。
- 语言标签：无。
- 语法高亮：无，纯等宽字体 + 背景色。
- mermaid 拦截：`code`/`pre` 覆盖中检测 `language-mermaid` className，命中则渲染 `<MermaidDiagram>`。

`MermaidDiagram`：动态 `import('mermaid')`，`securityLevel: 'strict'`，`theme: 'neutral'`，渲染产物 SVG 经 `DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })` 后 `dangerouslySetInnerHTML` 注入，三态 loading / ready / error。

### 3.4 流式渲染策略

没有专门的增量 / 防抖 / 分块渲染机制——react-markdown 每次重解析整个 content 字符串。优化集中在 store 层减少 re-render：`batchStreamChunkUpdate` 把 content 追加、metadata 合并、isStreaming 翻转、catStatus 合并到一次 `set()`。流式光标用 `animate-pulse` 闪烁竖条。无 `useDeferredValue` / `useTransition` / `React.memo` / rAF 节流。

### 3.5 富文本 / 自定义组件能力

markdown 内联增强（在文本节点注入非标准元素）：

- @mention 高亮：正则匹配 `@猫名`，按猫色着色 + 半透明背景 pill。
- 文件路径链接化：正则匹配绝对 / 相对路径 + `:行号`，生成 `vscode://file` 链接。
- textProcessor 扩展点：`ConciergeMessageContent` 用它把 `[跳过去 Rn]` / `[原地看 Rn]` 标记替换成内联按钮。

结构化富块（AI 下发 JSON，`message.extra.rich.blocks`）：

| kind | 文件 | 能力 |
|---|---|---|
| card | `rich/CardBlock.tsx` | 标题 / `bodyMarkdown`（用 MarkdownContent 渲染）/ fields / tone / actions 按钮 / 确认流 |
| diff | `rich/DiffBlock.tsx` → `workspace/DiffViewer.tsx` | 自写 unified diff 解析器，按行 add/remove/context 着色，无语法高亮 |
| checklist | `rich/ChecklistBlock.tsx` | 自定义勾选图标，checked 划线 |
| interactive | `rich/InteractiveBlock.tsx` | select / multi-select / card-grid / confirm，groupId 联动 + API callback 直发 |
| html_widget | `rich/HtmlWidgetBlock.tsx` | sandboxed iframe `srcDoc`，允许 script，禁 form/base/meta |
| file | `rich/FileBlock.tsx` | 文件附件 |
| audio | `rich/AudioBlock.tsx` | TTS / 语音播放 |
| media_gallery | `rich/MediaGalleryBlock.tsx` | 图片画廊 |

这些富块是平台自定义 JSON 协议，不是 markdown 扩展语法，AI 必须在 payload 里显式构造 `extra.rich.blocks`。

### 3.6 安全性

两层 sanitize，都用 dompurify：

1. Mermaid SVG：`USE_PROFILES: { svg: true, svgFilters: true }`。
2. HTML widget：`WHOLE_DOCUMENT: true`，`ADD_TAGS: ['script']`，`FORBID_TAGS: ['form','base','meta']`，配合 iframe `sandbox="allow-scripts"`（无 `allow-same-origin`）。

react-markdown 默认不渲染 raw HTML（无 rehype-raw），普通 markdown 内容天然不执行脚本。`dangerouslySetInnerHTML` 仅用于已 sanitize 的 mermaid SVG。

### 3.7 样式方案

Tailwind v3，无 `@tailwindcss/typography` / `prose` 类——所有排版样式靠 `buildMdComponents` 里每个组件的 Tailwind 类手写。设计 token 通过 CSS 变量注入。

## 4. 目标能力清单（分阶段）

### 阶段 1 — 基础 Markdown（必做）

- GFM：粗体 / 斜体 / 删除线 / 标题 / 有序无序列表 / 任务列表 / 表格 / 链接 / 引用块。
- 代码块：fenced code + 复制按钮 + 行内 code 样式。
- 软换行保留（`remark-breaks`，符合现有 `whitespace-pre-wrap` 直觉）。
- 不做语法高亮（Cat Cafe 也没做，等真有需求再加 shiki）。

### 阶段 2 — 安全 + 内联增强（推荐）

- `rehype-sanitize` 防 XSS（agent 输出虽是自家 LLM，但 content 来源含 callback / tool，仍建议加）。
- mention 渲染：把 content 里 `@handle` 高亮成 pill（现在只列在 footer，体验差）。需与后端 `MentionParser.ts` 边界规则对齐，且避开 code span 内的 `@`。
- 长文本折叠（CollapsibleMarkdown：超阈值收起 + "展开/收起"）。

### 阶段 3 — 富文本结构化块（按需，较大工程）

- 评估是否引入 `extra.rich.blocks` JSON 协议（callout / 卡片 / diff / checklist / 交互选择）。
- mermaid 图表（动态 import + DOMPurify SVG）。
- 这阶段要先确认 AI runner（ClaudeCli / CodexCli）能否产出结构化块，否则只是前端能力空悬。

## 5. 技术选型

| 项 | 选型 | 理由 |
|---|---|---|
| 渲染器 | `react-markdown` 10.x | 与 Cat Cafe 一致，React 19 兼容，组件覆盖 API 成熟 |
| GFM | `remark-gfm` 4.x | 表格 / 任务列表 / 删除线 |
| 换行 | `remark-breaks` 4.x | 单换行即 `<br>`，贴合现有 pre-wrap 体验 |
| 安全 | `rehype-sanitize` | 默认 react-markdown 不透传 raw HTML；若 agent 输出含 HTML 则配 sanitize。不建议 rehype-raw（Cat Cafe 不用，风险高） |
| 代码高亮 | 暂不引入 | Cat Cafe 没做；真要加用 `shiki`（比 highlight.js 产物干净），但 v4 适配成本不低 |
| mermaid | `mermaid` 11.x 动态 import + DOMPurify | 仅阶段 3 |
| 样式 | 自写组件类 + token alias | 不引入 `@tailwindcss/typography`（v4 + hex lint 适配麻烦，Cat Cafe 也是手写） |

与 Cat Cafe 的差异点：不要它的 `textProcessor` 工厂模式（TheTower 场景简单），直接在 `components` 映射里处理 mention 即可。富块协议也不要急着抄，先跑通 md。

## 6. 集成方案

### 6.1 新增依赖

`packages/web/package.json`：

```json
"react-markdown": "^10.1.0",
"remark-gfm": "^4.0.1",
"remark-breaks": "^4.0.0",
"rehype-sanitize": "^6.0.0"
```

### 6.2 新建渲染组件

`packages/web/src/components/markdown/MarkdownContent.tsx`（参考 Cat Cafe `MarkdownContent.tsx`，但简化）：

- `ReactMarkdown` + `remarkPlugins={[remarkGfm, remarkBreaks]}`。
- `components` 映射：`code` / `pre` → 自定义 CodeBlock（带复制按钮，走 `--tower-font-mono`）；`a` → `target=_blank` + `rel=noopener`；`table` → token 边框色。
- 文本节点 mention 高亮：写一个轻量 remark 插件或 `p` / `text` 覆盖里正则切分 `@handle`，命中渲染成 `<span className="text-tower-accent-*">`，跳过 code 内。

### 6.3 主改动点

`packages/web/src/components/command/MessageBubble.tsx` 第 82-86 行。当前分支：

```tsx
{isStream ? (
  <StreamOutput message={message} />   // CLI Output，origin === "agent_stream"
) : (
  <p className="...whitespace-pre-wrap...">{message.content}</p>
)}
```

改为在「非 stream」分支内再按 origin 细分：

```tsx
{isStream ? (
  <StreamOutput message={message} />
) : isCallback ? (
  <div className="markdown-body text-[13px] text-tower-text-primary">
    <MarkdownContent content={message.content} />
  </div>
) : (
  <p className="...whitespace-pre-wrap...">{message.content}</p>
)}
```

渲染判定：**仅 `origin === "callback"` 走 markdown 渲染**（`isCallback` 已是组件内现成变量，第 21 行）。

为什么只圈 callback：

- `callback` 是 agent 通过 `post_message` 主动发的可读消息（`extra.isExplicitPost: true`），是 agent 有意识组织格式化内容的地方——这正是值得 md 渲染的「AI 输出」。TheTower 里 agent 的最终回复就是 callback，没有单独的 `final` origin。
- `agent_stream`（CLI Output）是原始流式遥测（thinking / text / tool_call），按 chunk 在 `StreamOutput` 的 `<pre>` 里分段显示，**保持纯文本**，忠实呈现原始输出。
- `tool` / `system` / `briefing` 是机器态或内部上下文，保持纯文本。
- `user` 消息保持纯文本（防注入 + 用户本就用纯文本输入）。

这样切分与数据模型边界一致，也避免对原始遥测做 md 解析带来的不确定性（chunk 拼接可能切断 fenced code）。

### 6.4 样式（过 hex lint）

- 所有 md 元素颜色走 `text-tower-*` / `border-tower-*` / `bg-tower-*` alias。
- 代码块背景用一个新 semantic token（如 `--color-tower-code-bg`，在 `tower-tokens.css` 唯一允许 hex 的文件里定义），不要在组件里写 hex。
- 列表 / 标题 / 表格的 spacing 用 Tailwind utility 手写，不引入 prose。

### 6.5 流式（无需特殊处理）

TheTower 是全量重拉，`content` 永远是当前完整快照，不存在增量解析的 chunk 边界问题。每次重拉 react-markdown 重解析整段即可，性能足够（消息量不大）。Cat Cafe 的 `batchStreamChunkUpdate` 优化 TheTower 天然不需要。

## 7. 风险与约束

1. **next 16.2.9 锁定 + React 19**：react-markdown 10.x 兼容 React 19，需 `pnpm install` 后验证无 peer warning。
2. **hex lint**：`scripts/check-no-hex-colors.mjs` 会卡，所有颜色必须在 token 文件里定义。
3. **stream 合成消息**：`messageProjection.projectMessagesToBubbles` 把 stream chunk 用 `\n` 拼成合成消息，若未来要给它做 md，拼接可能切断 fenced code 块——阶段 1 先不做，观察。
4. **mention 边界**：`lib/mention.ts` 顶部注释要求"镜像后端 MentionParser"，前端 md 内 mention 高亮要用同一套边界规则，否则 `@a.b` 之类会不一致。
5. **RawMessageRow**：telemetry 调试视图保持 `<pre>` 不动（调试要忠实原文）。

## 8. 落地顺序

1. 装依赖 + 写 `MarkdownContent`（基础 md + CodeBlock 复制按钮）。
2. 改 `MessageBubble` 的 callback 分支接进去（`isCallback` 走 `MarkdownContent`，其余非 stream 分支保持 `<p>`）+ 加 token。
3. 加 `rehype-sanitize`。
4. 加 mention 高亮（对齐后端边界）。
5. 加 CollapsibleMarkdown 长文本折叠。
6. 跑 `pnpm lint`（tsc + hex check）确认通过。
7. 阶段 3 的富块协议单独立项评估。

## 9. 关键文件参考

Cat Cafe（绝对路径）：

- `/Users/xuchenyang/ai/clowder-ai/packages/web/src/components/MarkdownContent.tsx` — react-markdown 入口 + 组件覆盖工厂 + mentions / 文件路径链接 / CodeBlock
- `/Users/xuchenyang/ai/clowder-ai/packages/web/src/components/CollapsibleMarkdown.tsx` — 长文本折叠包装
- `/Users/xuchenyang/ai/clowder-ai/packages/web/src/components/MermaidDiagram.tsx` — mermaid 动态渲染 + DOMPurify
- `/Users/xuchenyang/ai/clowder-ai/packages/web/src/components/rich/RichBlocks.tsx` — 富块调度器 + 分组
- `/Users/xuchenyang/ai/clowder-ai/packages/web/src/stores/chat-types.ts`（第 74-219 行）— RichBlock 类型定义
- `/Users/xuchenyang/ai/clowder-ai/packages/web/src/components/ChatMessage.tsx` — 消息组件渲染分支
- `/Users/xuchenyang/ai/clowder-ai/packages/web/src/stores/chatStore.ts`（第 3003 行 `batchStreamChunkUpdate`）— 流式批量更新

TheTower 改动点（绝对路径）：

- `/Users/xuchenyang/ai/TheTower/packages/web/src/components/command/MessageBubble.tsx`（第 83-85 行）— 主改动点
- `/Users/xuchenyang/ai/TheTower/packages/web/src/components/command/MessageBubble.tsx` `StreamOutput` — stream chunk 展示，暂不动
- `/Users/xuchenyang/ai/TheTower/packages/web/src/components/telemetry/RawMessageRow.tsx` — 调试视图，保持纯文本
- `/Users/xuchenyang/ai/TheTower/packages/web/src/lib/mention.ts` — mention 边界规则（镜像后端 `MentionParser`）
- `/Users/xuchenyang/ai/TheTower/packages/web/src/messageProjection.ts` — stream chunk 聚合逻辑
- `/Users/xuchenyang/ai/TheTower/packages/web/src/styles/tower-tokens.css` — token 定义（唯一允许 hex）
- `/Users/xuchenyang/ai/TheTower/packages/web/package.json` — 新增依赖
