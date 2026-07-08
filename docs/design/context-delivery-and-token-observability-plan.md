# Agent Context Delivery 与 Token Observability 最终落地方案

## 目标

TheTower 需要解决两个相邻但独立的问题：

1. **如何优化 Agent 上下文逻辑，以及上下文超出时如何处理。**
2. **如何正确显示 context token。**

这两个问题不能合并成一个“context token 系统”。正确边界是：

```text
Agent Context Delivery System
  负责：Agent 本轮实际看到什么、为什么看到、超出时如何降级。

Token Observability System
  负责：provider usage、provider context health、TheTower package estimate 如何展示。
```

两个系统只在 telemetry / UI 层同屏展示，不共享核心判断口径。

## Cat Cafe 参考结论

参考项目：`/Users/xuchenyang/ai/clowder-ai`

关键参考：

- `docs/features/F148-hierarchical-context-transport.md`
  - 分层上下文传输：recent burst、tombstone、anchors、coverage map。
- `docs/features/F236-anchor-first-context-entry.md`
  - 返回侧 token 减负：preview + drill-down。
- `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts`
  - per-cat cursor、visibility filter、smart window、coverage map。
- `packages/api/src/domains/cats/services/agents/routing/context-transport.ts`
  - `CoverageMap`、recent burst detection、tombstone、anchors。
- `packages/shared/src/types/session.ts`
  - `ContextHealth` 与 context management hint。
- `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts`
  - provider usage 与 context health 分离。

可迁移原则：

1. Agent 默认不吃整个 thread 原文，而是吃 per-agent context package。
2. 上下文是可降级的传输协议，不是 last-N message。
3. 被省略的内容必须有 coverage / tombstone / anchors / drill-down。
4. 工具返回也要 anchor-first，否则运行中工具结果会再次塞爆 context。
5. usage、context health、package estimate 是三个不同指标。

不直接照搬：

- 不第一步引入 Cat Cafe 的完整 session chain、auto-seal、eval verdict。
- 不用 cheap model 临场总结历史。
- 不把 Cat Cafe 的 `system_info JSON` 承载方式搬到 TheTower；TheTower 继续使用 runtime status + SSE。

## 问题一：Agent Context Delivery System

### 目标状态

每次 Agent invocation 都由唯一入口构造上下文：

```text
Invocation state
+ thread messages
+ visibility policy
+ route/worklist state
+ tool/memory/task hints
-> ContextPackageBuilder
-> AgentContextPackage
-> CliPromptBuilder
-> Provider Runner
```

任何 runner 初始 prompt、callback `get_thread_context`、telemetry inspect，都必须能追溯到同一套 context package 语义。

### 核心数据模型

```ts
export interface AgentContextPackage {
  threadId: string;
  agentId: string;
  invocationId: string;
  mode: "debug" | "play";
  sections: AgentContextSection[];
  coverageMap: AgentContextCoverageMap;
  estimate: ContextPackageEstimate;
  boundary?: ContextBoundary;
  degradation?: ContextDegradation;
}
```

```ts
export interface AgentContextSection {
  kind:
    | "navigation"
    | "trigger"
    | "recent_burst"
    | "anchor"
    | "tombstone"
    | "handoff"
    | "thread_memory"
    | "tool_digest"
    | "retrieval_hint";
  title: string;
  content: string;
  messageIds?: string[];
  estimatedTokens?: number;
  priority: "must_keep" | "high" | "medium" | "low";
}
```

```ts
export interface AgentContextCoverageMap {
  includedMessageIds: string[];
  omittedRanges: Array<{
    fromMessageId?: string;
    toMessageId?: string;
    fromCreatedAt: number;
    toCreatedAt: number;
    count: number;
    participants: string[];
    reason: "cursor_seen" | "smart_window" | "budget_trim" | "visibility" | "stream_ineligible";
  }>;
  anchorMessageIds: string[];
  retrievalHints: string[];
}
```

```ts
export interface ContextPackageEstimate {
  estimatedTokens: number;
  estimator: "heuristic_v1" | "provider_tokenizer" | "unavailable";
  budgetTokens?: number;
}
```

```ts
export interface ContextBoundary {
  lastEligibleMessageId?: string;
  lastEligibleCreatedAt?: number;
  cursorAdvanced: boolean;
}
```

```ts
export interface ContextDegradation {
  triggered: boolean;
  reason: "count" | "estimated_tokens" | "single_item" | "hard_budget";
  steps: Array<{
    action:
      | "drop_retrieval_hints"
      | "compact_thread_memory"
      | "drop_low_score_anchor"
      | "compact_tombstone"
      | "trim_oldest_burst"
      | "compact_tool_digest"
      | "hard_fail";
    beforeTokens?: number;
    afterTokens?: number;
    note: string;
  }>;
}
```

### Context sections

#### 1. Navigation / Baton

永远保留，回答：

```text
为什么叫我？
球怎么来的？
我负责哪一段？
做完要不要继续交给谁？
```

内容：

- `threadId`
- `invocationId`
- `routeMode`
- worklist position
- `directMessageFrom`
- `remainingAgents`
- `a2aEnabled`
- trigger origin
- task / artifact / truth source 指针

#### 2. Current Trigger

永远保留：

- 当前用户消息。
- 当前 callback / handoff message。
- `handoffPayload` 五件套。
- 当前 @ mention 原文。

如果 trigger 本身超大，必须先 anchor 化，而不是静默截断。

#### 3. Recent Burst

取最近完整交互片段，不是固定 last-N：

- 按 silence gap 切分。
- 最少保留一个完整问答回合。
- 不切断 reply parent。
- 不切断 tool call -> tool result。
- 不切断 handoff -> acknowledgement。

#### 4. Anchors

从被省略历史里挑少量高价值原文：

- thread opener。
- 关键决策。
- open question。
- handoff / @ 当前 agent。
- 代码块或 patch。
- task / artifact / PR 指针。
- 与当前 trigger 关键词重合高的消息。

anchors 是“原文锚点”，不是 LLM summary。

#### 5. Tombstone

对省略区间做零成本结构摘要：

```text
omitted 42 messages, 10:00-11:30
participants: user, zavala, banshee
keywords: context, token, smart window
retrieval: get_thread_context(keyword="smart window")
```

tombstone 的职责是让 Agent 知道“没看全”，并知道如何 drill。

#### 6. Thread Memory / Decision Ledger

最终态需要一个结构化 ledger：

- decisions
- openQuestions
- recentArtifacts
- truthSource
- activeTasks

这不是 Phase 1 的 MVP，但最终系统必须有。否则长 thread 只能靠 tombstone 和 anchors，缺少稳定状态层。

#### 7. Tool Digest

旧工具结果默认不原文注入：

```text
shell_exec pnpm test: exit=0, 148 lines, omitted=12k chars, drillDown=...
read_file src/foo.ts: 430 lines, preview lines 1-40, drillDown=read_file_slice
```

#### 8. Retrieval Hints

告诉 Agent 如何继续查，而不是直接塞全文：

- `get_message(messageId, mode="full")`
- `get_thread_context(keyword=...)`
- `read_file_slice(path, start, end)`
- future `search_evidence`

### Context eligibility

进入 Agent cognition 的消息必须先通过 eligibility：

```ts
export function canIncludeInContextPackage(input: {
  message: Message;
  viewer: { type: "agent"; agentId: string };
  mode: "debug" | "play";
}): boolean;
```

规则：

- user message：可见则 eligible。
- callback message：可见则 eligible，是 Agent 协作事实。
- handoff message：目标 Agent eligible。
- system briefing：默认不 eligible，除非显式指定。
- `agent_stream.thinking`：不 eligible。
- `agent_stream.tool_call`：不 eligible，只进 audit。
- `agent_stream.text`：默认不 eligible；公开协作事实必须走 callback。
- `agent_stream.error`：不 eligible，走 system/audit。

这条规则是最终方案的硬边界。否则 cursor 和 smart window 会被 stream chunk 污染。

### Per-agent cursor

每个 Agent 有自己的上下文游标：

```text
agent_context_cursors(thread_id, agent_id, last_seen_eligible_message_id, updated_at)
```

规则：

- cursor 只针对 context-eligible message。
- visibility filtered-out 不推进 cursor。
- 只有 stream chunks 时不推进 cursor。
- package 成功构造且 invocation 开始执行后推进 cursor。
- smart window 省略旧消息时，cursor 仍可推进到 eligible boundary，因为 coverageMap 已记录省略。

### Package overflow handling

上下文超出分两类。

#### A. Package assembly overflow

TheTower 在调用 provider 前发现 package 超预算。

处理顺序：

```text
0. must_keep 永不丢：navigation + trigger + handoffPayload
1. drop / compact retrieval hints
2. compact thread memory
3. drop low-score anchors
4. compact tombstone
5. trim oldest recent burst
6. compact tool digest
7. 最小包仍超预算：不调用模型，发布 context_overflow
```

最终失败不是 provider error，而是 TheTower 的结构化事件：

```ts
export interface ContextOverflowEvent {
  threadId: string;
  invocationId: string;
  agentId: string;
  estimatedTokens: number;
  budgetTokens: number;
  minimumPackageTokens: number;
  reason: "minimum_package_exceeds_budget";
  suggestedActions: string[];
}
```

#### B. Provider session context overflow

provider 会话本身接近窗口上限。

这不由 Context Delivery System 判断，而由 Token Observability System 的 `ContextHealth` 驱动：

- warn：注入 context-management hint。
- action：新 session / handoff / compact / reset。
- unavailable：不自动 action，只提示 unknown。

### Anchor-first tool return

所有读类 MCP / callback 工具默认 preview：

```ts
export interface AnchorPreview {
  id: string;
  kind: "message" | "file" | "shell_output" | "task" | "artifact";
  label: string;
  preview: string;
  contentLength?: number;
  lineCount?: number;
  truncated: boolean;
  drillDown: DrillDownPointer;
}
```

```ts
export interface DrillDownPointer {
  tool: "get_message" | "get_thread_context" | "read_file_slice" | "read_artifact";
  args: Record<string, unknown>;
}
```

默认策略：

- `get_thread_context`：preview list。
- `get_message`：显式 full drill。
- `read_file`：大文件 preview + slice hints。
- `shell_exec`：head/tail + omitted count + artifact path。

### Context Delivery 验收标准

- 每次 invocation 都能 inspect `AgentContextPackage`。
- Agent 默认不接收整个 thread 原文。
- long thread 有 recent burst / anchors / tombstone / coverage map。
- package overflow 不会静默截断。
- stream chunks 不污染 context。
- callback 是 Agent 协作事实的主要载体。
- 所有可见性仍由 `VisibilityPolicy` 控制。

## 问题二：Token Observability System

### 目标状态

UI 永远分开展示三类数字：

```text
context   Context 72.1k / 200k exact
package   Package est 24.3k
usage     In 289.2k · Out 11.0k · Cache 180k
```

含义：

- `context`：provider 当前上下文窗口占用。
- `package`：TheTower 本轮构造的上下文包估算。
- `usage`：provider 用量 / 计费 / 缓存统计。

它们不能相加，不能互相替代。

### 数据模型

#### ProviderUsage

```ts
export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  durationMs?: number;
  durationApiMs?: number;
  numTurns?: number;
  isCumulativeUsage?: boolean;
  source: "provider" | "estimated" | "unavailable";
}
```

职责：

- billing / usage / cost。
- 可以累计。
- 不能用于 package trim。
- 不能自动生成 context health。

#### ProviderContextHealth

```ts
export interface ProviderContextHealth {
  usedTokens: number;
  windowTokens: number;
  fillRatio: number;
  source: "exact" | "approx";
  usedFrom: "context_used" | "last_turn" | "provider_snapshot";
  measuredAt: number;
  resetsAtMs?: number;
}
```

职责：

- provider 当前窗口填充。
- 永远是 latest snapshot。
- 不累计。
- 只能来自可靠 fill signal。

#### PackageTokenEstimate

```ts
export interface PackageTokenEstimate {
  estimatedTokens: number;
  estimator: "heuristic_v1" | "provider_tokenizer" | "unavailable";
  budgetTokens?: number;
}
```

职责：

- TheTower 组包预算控制。
- 可以用于 package overflow handling。
- 不能显示成 provider context fill。

### Provider adapter 规则

#### Claude CLI

- `result.usage` 只进入 `ProviderUsage`。
- `cache_read_input_tokens` / `cache_creation_input_tokens` 进入 usage detail。
- 只有确认 stream-json 中存在 per-turn input / context snapshot，才生成 `ProviderContextHealth`。
- 没有 per-turn signal 时显示 `Context --`。

#### Codex

- 如果能读取 session `token_count`：
  - `contextUsedTokens + model_context_window` -> `ProviderContextHealth exact`
  - `last_token_usage` / `total_token_usage` -> `ProviderUsage`
- 如果只有 turn usage：
  - 进入 `ProviderUsage`
  - `Context --`

#### Gemini

- cumulative-only stats 只进 `ProviderUsage`。
- 没有 per-turn signal 时 `Context --`。
- 不用 cumulative input 判断 context fill。

#### OpenAI API / Custom

- response usage 进入 `ProviderUsage`。
- 只有 adapter 能证明 `input_tokens` 表示当前请求实际上下文时，才生成 `ProviderContextHealth`。
- custom provider 默认 `Context --`，除非 adapter 显式声明 capability。

### Capability declaration

每个 provider adapter 声明能力：

```ts
export interface ProviderTokenCapability {
  usage: "none" | "aggregate" | "per_turn";
  contextHealth: "none" | "approx" | "exact";
  contextWindow: "none" | "fallback" | "provider";
}
```

UI 根据 capability 决定标签和 tooltip。

### 展示规则

状态卡：

```text
context   Context 72.1k / 200k exact
package   Package est 24.3k heuristic
usage     In 289.2k · Out 11.0k · Cache 180k
```

如果无真实 context：

```text
context   Context --
package   Package est 24.3k heuristic
usage     In 289.2k · Out 11.0k · Cache 180k
```

tooltip 必须解释：

- usage 是计费 / 累计口径。
- package 是 TheTower 本轮估算。
- context 是 provider 窗口填充。
- unavailable 是未知，不是 0。

### Token Observability 验收标准

- `Usage In 289k` 超过模型窗口不会显示成爆窗。
- cache-heavy Claude invocation 不产生假 `Context used/window`。
- provider 没有 fill signal 时显示 `Context --`。
- package estimate 单独显示，不冒充 provider context。
- registry 累加 usage，但 context health 覆盖为 latest。
- 前端不估算 token。

## 两个系统的边界

```text
Context Delivery System
  输入：thread messages / route state / visibility / tool artifacts
  输出：AgentContextPackage / PackageTokenEstimate / CoverageMap

Token Observability System
  输入：provider events / adapter capability / provider usage
  输出：ProviderUsage / ProviderContextHealth

Telemetry UI
  同屏展示 package / context / usage
```

禁止事项：

- 禁止用 `ProviderUsage.inputTokens` 做 package trim。
- 禁止用 `PackageTokenEstimate` 显示 `Context used/window`。
- 禁止用 cumulative usage 推断 context health。
- 禁止让 stream chunks 默认进入 Agent context。
- 禁止 silent truncation。

## 最终实施顺序

### 0. 事实校验

1. 采集 Claude CLI stream-json fixture，确认 per-turn context signal。
2. 建立 `TokenEstimator`，哪怕第一版是保守 heuristic。
3. 明确 `agent_stream` context eligibility。
4. 为上述三项写测试。

### 1. Token Observability 独立落地

1. 拆 `ProviderUsage` / `ProviderContextHealth` / `PackageTokenEstimate` 类型。
2. 修 Claude usage parser：aggregate usage 不再写 context health。
3. runtime status 同时携带 usage 与 context health。
4. UI 拆 context / package / usage 三行。

### 2. ContextPackageBuilder 落地

1. `ContextBuilder` 升级为 `ContextPackageBuilder`。
2. 建立 section / coverage map / estimate。
3. `CliPromptBuilder` 消费 sections。
4. Telemetry 可 inspect package。

### 3. Context eligibility 与 cursor

1. 抽 `canIncludeInContextPackage()`。
2. 排除 `agent_stream` chunk。
3. 新增 per-agent cursor store。
4. cursor 只推进 eligible boundary。

### 4. Smart window 与 overflow

1. recent burst。
2. tombstone。
3. anchors。
4. tool digest。
5. degradation steps。
6. minimum package overflow -> structured `context_overflow`。

### 5. Anchor-first tools

1. `get_thread_context` preview 默认。
2. `get_message` full drill。
3. `read_file` preview / slice。
4. `shell_exec` head/tail/artifact。

### 6. Session-level context management

1. context health warn。
2. context-management hint。
3. compact / new session / handoff 策略。
4. 这一步依赖 provider health，不依赖 package estimate。

## 与现有文档关系

- 本文替代旧的 Context Token 与 Agent 上下文耦合方案。
- [Provider Token Usage 设计方案](./provider-token-usage-design.md) 后续应收敛到本文的 Token Observability System。
- [Phase 3：ContextBuilder 统一上下文入口](../phases/collaboration/phase-3-context-builder.md) 后续应升级到本文的 Context Delivery System。
- [Agent Runtime Status：一步到位阶段方案](../phases/agent-status/agent-status-runtime-phases.md) 后续应补充 `ProviderContextHealth` 与 package estimate 展示。
