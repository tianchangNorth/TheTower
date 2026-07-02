# A2A 路由与输出隔离：TheTower vs 猫咖（clowder-ai）对比

生成时间：2026-07-01

本文对照 [TheTower 当前 A2A 整体架构](./current-a2a-architecture.md)，与猫咖仓库（`/Users/xuchenyang/ai/clowder-ai`）的 A2A 路由 / 输出隔离实现做差异对比。重点回答一个具体问题：**被调用 Agent 的"内心独白"（thinking、工具调用日志）如何不泄漏到其他 Agent 的视野。**

---

## 0. 一句话结论

| 维度 | TheTower | 猫咖 |
| --- | --- | --- |
| 隔离的语义模型 | **消息级可见性**（public/private + visibleToAgentIds + revealedAt） | **通道级隔离**（origin=stream/callback，play 模式过滤他猫 stream） |
| 内心独白载体 | `origin=agent_stream` 的 Message | `origin=stream` 的 Message（thinking / tool 日志同通道） |
| 隔离执行点 | `VisibilityPolicy` + `ContextBuilder`（统一入口） | 上下文装配层 + 3 个 MCP 读端点（分散但等价） |
| 公开发言通道 | `origin=callback` / `agent_final`，且 callback 支持 private | `origin=callback` + `isExplicitPost:true`（callback 仅公开） |
| 模式开关 | `ThreadMode = debug \| play` | `thinkingMode = debug \| play` |
| 私密消息 | 显式 `visibility=private` + `visibleToAgentIds` | whisper（F035，按收件人过滤）+ stream 隔离 |
| 路由治理 | `routeMode`(single/serial/fanout/parallel) + Skills + Worklist 防重复 | routeSerial/routeParallel + a2a-mentions + 自引用过滤 |
| 结构化交接 | `HandoffPayload` 五件套 | 无（靠 `@mention` + post_message 文本） |
| 前端分桶 | Phase 6 通道语义（callback 独立 / final 去重） | `bubble-projection` + `#814` 防止 callback 被吞进 stream bubble |
| 设计驱动 | 协作治理 + 可审计 | 狼人杀等游戏隐私场景 |

**核心差异**：TheTower 用"消息可见性字段"做隔离（每条消息自带 public/private 元数据 + 收件人列表）；猫咖用"origin 通道标签 + 模式开关"做隔离（stream 通道在 play 模式下对他猫整体隐藏，不区分收件人）。两者都在**上下文装配层**而非广播层落地隔离。

---

## 1. 通道与 Origin 模型对比

### 1.1 Origin 枚举

TheTower（7 类，语义更细）：

```ts
export type MessageOrigin =
  | "user" | "agent_final" | "agent_stream"
  | "callback" | "tool" | "system" | "briefing";
```

猫咖（3 类，更粗）：

```ts
origin?: 'stream' | 'callback' | 'briefing';
```

差异：

- TheTower 把 Agent 输出拆成 `agent_final`（最终回复）和 `agent_stream`（过程流）两条；猫咖只有一个 `stream`，最终回复也走 stream 通道，靠 `isExplicitPost` 区分公开发言。
- TheTower 有独立的 `tool` / `system` origin；猫咖把 tool 日志也归入 `stream`。
- 猫咖的 `callback` 严格等于"猫主动 post_message 的公开发言"；TheTower 的 `callback` 还可以 `visibility=private`，语义更宽。

### 1.2 内心独白载体

| | TheTower | 猫咖 |
| --- | --- | --- |
| thinking / 推理 | 无独立字段，归入 `agent_stream` | 归入 `stream`，且 `chat-types.ts:356` 注释明确"extended reasoning 在任何模式下都不跨猫共享"——比 stream text 更严 |
| 工具调用日志 | `origin=tool` | 归入 `stream` |
| 最终回复 | `origin=agent_final` | 走 `stream` 通道，但靠 `isExplicitPost` 标记为公开发言 |

猫咖的"thinking 永不共享"是 TheTower 没有的强约束。TheTower 的 `agent_stream` 在 play 模式下隐藏，但没有"thinking 字段独立于 origin"的概念。

---

## 2. 隔离执行点对比

这是核心差异。两个系统都认识到：**隔离不能在广播层做（operator 要审计），必须在上下文装配层做。** 但落地形态不同。

### 2.1 TheTower：统一入口 ContextBuilder + VisibilityPolicy

单一入口，所有 Agent 上下文都走：

```ts
ContextBuilder.buildForAgent({ threadId, agentId, mode, limit });
```

`VisibilityPolicy` 集中判断每条消息对该 Agent 是否可见：

- public message 可见。
- private message 只对 `visibleToAgentIds` 可见。
- revealed private message 全员可见。
- canceled / queued 不进入普通上下文。
- briefing 默认不进入普通上下文。
- **play 模式下隐藏其他 Agent 的 `agent_stream`**。

callback `get_thread_context` 也走 `ContextBuilder`，所以主动拉上下文和被动注入看到同一套可见集合。

### 2.2 猫咖：分散但等价的 3 个执行点

猫咖没有独立的 `ContextBuilder` / `VisibilityPolicy` 模块，隔离散落在 3 处，都受 `thinkingMode` 控制：

**(a) 自动注入增量历史** — `route-helpers.ts:728` `assembleIncrementalContext()`：

```ts
// In play mode, hide other cats' stream (thinking) messages.
if ((thinkingMode ?? 'play') === 'play' && m.catId !== null && m.origin === 'stream') return false;
```

**(b) previousResponses 共享** — `route-serial.ts:2018`：

```ts
// In play mode, CLI stream output (thinking) is hidden from other cats.
// Only share previousResponses in debug mode
if (!incrementalMode && thinkingMode === 'debug') {
  previousResponses.push({ catId, content: storedContent });
}
```

**(c) 猫主动拉上下文的 MCP 端点** — `callbacks.ts`：

- `thread-context`（L2002）：`if (isOtherCat && item.origin === 'stream') return false;`
- `get-message`（L2266）：他猫 stream 直接返回 404。
- `pending-mentions`（L2341）：同样过滤。

差异要点：

| | TheTower | 猫咖 |
| --- | --- | --- |
| 入口统一性 | 单一 `ContextBuilder` | 3 处分散执行点 + 1 处 `previousResponses` 共享控制 |
| 主动拉上下文 | `get_thread_context` 走 `ContextBuilder`，天然一致 | 需要在 3 个 MCP 端点各自重复过滤逻辑 |
| 维护成本 | 加新读端点只需调 `ContextBuilder` | 加新读端点必须记得复制 play 过滤，否则泄漏 |

> **TheTower 的设计在此处更稳健**：隔离逻辑集中在一处，新端点难以绕过。猫咖的分散过滤是潜在泄漏面（任何新增的 context 读取端点都必须记得加 play 过滤）。

---

## 3. 公开发言通道对比

### 3.1 TheTower

公开发言有两条路径：

1. `origin=agent_final`：Agent 的最终文本回复。
2. `origin=callback`：Agent 通过 MCP / HTTP callback 主动 `post_message`，默认 `visibility=public`，也可 `private`。

前端 Phase 6 通道语义：

- callback 且 `extra.isExplicitPost=true` → 独立发言展示。
- `agent_final` 与已写 callback 内容完全相同 → 抑制重复 final。
- `agent_final` 与 callback 内容不同 → 均正常展示。
- `agent_stream` 仅表示运行过程，不承载正式最终回复。

### 3.2 猫咖

公开发言只有一条路径：`origin=callback` + `extra.isExplicitPost=true`。

- CLI stream text 即使是最终回复，也打标 `origin=stream`。
- `#814` 设计决策：callback 标记 `isExplicitPost=true`，让前端 TD112 去重逻辑**不要**把它合并进猫的 CLI stream bubble——保持独立发言气泡。
- callback 不支持 private（私密靠 whisper F035 单独机制）。

差异：

- TheTower 区分"最终回复"和"callback 发言"两条公开通道，并有内容比对去重；猫咖只有 callback 一条公开通道，stream 即使含最终文本也被视为内部。
- 猫咖的 `isExplicitPost` 和 TheTower 的 `isExplicitPost` 同名同义，都是为了前端气泡分桶——**这是两边唯一明显同源的约定**，TheTower Phase 6 文档直接参考了猫咖的 `#814`。

---

## 4. 模式开关对比

| | TheTower `ThreadMode` | 猫咖 `thinkingMode` |
| --- | --- | --- |
| 取值 | `debug \| play` | `debug \| play` |
| 存储位置 | `ThreadStore`，thread 级 | `RedisThreadStore`，thread 级 |
| 默认值 | （文档未明确，由 ThreadStore 决定） | **不一致**：路由层默认 `play`，持久化层默认 `debug`，callback 用 `?? 'debug'` |
| debug 语义 | 保留更多上下文可见性，方便排障 | `viewer={type:'user'}`，猫看到一切（含他猫 stream + 所有 whisper） |
| play 语义 | 严格隐藏其他 Agent 的 private message 和 hidden stream | 隐藏他猫 stream，whisper 按收件人过滤 |
| 切换入口 | Threads 面板 debug/play badge | `threads.ts` thread 级字段可切换 |

> **猫咖的默认值不一致是个坑**：`RedisThreadStore.ts` 持久化层默认 `debug`（L880/1004/1091），但 `AgentRouter.ts:1431/1604` 和 `route-serial.ts:479` 路由层默认 `play`。实际生效以路由层 `play` 为准（路由是隔离执行点），但 callback 端点用 `?? 'debug'`，理论上存在路由按 play 隔离、callback 按 debug 放行的窗口。TheTower 应保证 `ThreadMode` 默认值单一来源，避免类似问题。

---

## 5. 私密消息机制对比

这是两套设计哲学分歧最大的地方。

### 5.1 TheTower：消息级 visibility

每条 Message 自带可见性元数据：

```ts
visibility?: "public" | "private";
visibleToAgentIds?: string[];
revealedAt?: number;
```

- private 必须显式声明，自动把 sender 加入 `visibleToAgentIds`。
- `targetAgents` 是路由目标，不等于可见范围（路由给 B 的消息，可见范围可以仍包含 A）。
- private 可审计、可 reveal（设置 `revealedAt` 后全员可见）。
- 用户视角始终审计所有消息。

### 5.2 猫咖：whisper（F035）+ stream 隔离

- 没有消息级 `visibility` / `visibleToAgentIds` 字段。
- 私密靠 whisper 机制（`visibility.ts` `canViewMessage`）：user 看全部；cat 看 public + 自己的 whisper。
- stream 隔离是通道级的：play 模式下他猫的 stream 整体不可见，不区分收件人。
- 跨线程身份隔离（F052）暴露了一个微妙点：`m.catId === catId` 自过滤会误杀同猫跨线程消息，需用 `extra.crossPost` 豁免——说明 stream 隔离和 self-filter 共用同一套过滤管线。

差异：

| | TheTower | 猫咖 |
| --- | --- | --- |
| 粒度 | 消息级，可指定任意收件人子集 | 通道级 + whisper 收件人 |
| 路由目标 vs 可见范围 | 解耦（targetAgents ≠ visibleToAgentIds） | 耦合（whisper 收件人即可见范围） |
| 可审计 + 可 reveal | 是（revealedAt） | whisper 可审计，但无 reveal 机制 |
| 适用场景 | 通用协作（指定某些 Agent 看到交接细节） | 游戏隐私（狼人杀"天黑请闭眼"式全员隔离） |

> TheTower 的消息级 visibility 更灵活，适合工程协作场景（"这条交接只给 B 看"）；猫咖的通道级隔离更适合游戏场景（"狼人猫的推理全程对其他猫不可见"），但无法表达"只给某个猫看"的细粒度。

---

## 6. 路由模型对比

### 6.1 路由入口

| | TheTower | 猫咖 |
| --- | --- | --- |
| 文本路由 | 行首 `@handle`，`MentionParser` 解析 | 行首 `@mention`，`a2a-mentions.ts` 解析 |
| 结构化路由 | API/callback/MCP 的 `targetAgents` | （未发现等价结构化字段，靠文本 @mention） |
| 自引用过滤 | WorklistRegistry 防 ping-pong | `a2a-mentions.ts` `if (id === currentCatId) continue` |

### 6.2 routeMode

TheTower 有显式 `routeMode`：`single | serial | fanout | parallel`，默认推断（单目标 single，多目标 fanout），并在 fanout/parallel 下禁止普通文本继续解析 A2A 防重复唤醒。

猫咖有 `routeSerial` / `routeParallel` 两条路由实现，但没有文档化的 `routeMode` 枚举和 fanout 防重复治理。串行链靠 `previousResponses` 共享（debug 模式）和 `enqueueA2ATargets` worklist 推进。

> TheTower 的 routeMode 治理更完整，尤其 fanout 防重复路由是猫咖未明确覆盖的场景。

### 6.3 结构化交接

TheTower 有 `HandoffPayload` 五件套（what/why/tradeoff/openQuestions/nextAction + evidenceRefs + riskLevel），只注入给目标 Agent，不污染用户 timeline。

猫咖无等价结构，交接靠 `@mention` + `post_message` 文本。

> 这是 TheTower 明显的增量能力，猫咖的游戏场景不需要结构化交接。

---

## 7. 进程与通信边界对比

两者都是**不共享进程**的模型：每个 Agent 是独立 CLI 子进程，通过 stdout NDJSON 产出事件，Agent 之间无直接 IPC，唯一通信媒介是 MessageStore + 广播。

| | TheTower | 猫咖 |
| --- | --- | --- |
| CLI 启动 | `CodexCliRunner` / `ClaudeCliRunner` | `cli-spawn.ts` 通用 spawner + 各 provider service |
| MCP 挂载 | `--mcp-config` / `codex exec -c mcp_servers.thetower.*` | 各 provider 自行挂载 |
| callback env | per-invocation 5 个 env，注入子进程 + MCP server | callback token + agent-key 路径 |
| 广播出口 | `EventBus` / SSE | `SocketManager.broadcastAgentMessage`（唯一 choke point） |
| HTTP callback fallback | 保留（MCP 不可用时） | callback 同时支持 agent-key 和调用方两条路径 |

两者在进程隔离上基本同构，差异主要在命名和 MCP 挂载方式。

---

## 8. 前端投影对比

| | TheTower | 猫咖 |
| --- | --- | --- |
| 分桶逻辑 | Phase 6 通道语义（callback 独立 / final 去重 / stream 过程） | `bubble-projection.ts`，stream 和 callback 分桶 |
| 防吞并 | callback 与 final 内容相同则抑制 final | `#814` `isExplicitPost` 防止 callback 被吞进 stream bubble |
| 审计面板 | message / private / handoff / invocation / events 多面板 | "CLI Output" 时间线（旧文案"💭 心里话"） |
| operator 可见性 | 全量审计 | 全量可见（stream 也广播给房间） |

> 两者前端目标一致：operator 始终能审计全部（包括 stream/内心独白），隔离只对 Agent 生效。猫咖的 `#814` 和 TheTower 的 Phase 6 通道语义是同一设计意图的两种实现，TheTower 文档明确参考了猫咖。

---

## 9. TheTower 可借鉴的点

基于猫咖实现，TheTower 可以考虑：

1. **thinking 字段独立于 origin**：猫咖明确"extended reasoning 在任何模式下都不跨猫共享"，比 stream text 更严。TheTower 当前 `agent_stream` 在 play 模式下隐藏，但没有区分"普通 stream text"和"extended reasoning"——如果未来接入支持 reasoning 的 provider，可能需要独立的 thinking 可见性策略。
2. **默认值单一来源**：猫咖 `thinkingMode` 在持久化层（debug）和路由层（play）默认值不一致是反面教材。TheTower 应确保 `ThreadMode` 默认值只在一个地方定义。
3. **广播 choke point**：猫咖 `SocketManager.broadcastAgentMessage` 是唯一广播出口，便于审计。TheTower 的 `EventBus` 也应保持单一出口，避免多处直接 emit 绕过审计。

## 10. 猫咖相对 TheTower 的不足

1. **隔离执行点分散**：3 个 MCP 读端点 + `previousResponses` 各自重复 play 过滤逻辑，新增读端点易泄漏。TheTower 的统一 `ContextBuilder` 更稳健。
2. **默认值不一致**：如上所述，存在路由按 play、callback 按 debug 的理论窗口。
3. **无 routeMode 治理**：缺乏 fanout 防重复路由的显式模式。
4. **无结构化交接**：无 `HandoffPayload`，工程协作场景表达力弱。
5. **私密消息粒度粗**：通道级隔离 + whisper 收件人，无法表达"只给某个猫看某条消息"且可 reveal。

---

## 11. 核心文件对照表

| 职责 | TheTower | 猫咖 |
| --- | --- | --- |
| Origin 打标（stream） | runner 写入 `agent_stream` | `route-serial.ts:1176` `toStreamEvent()` |
| Origin 打标（callback） | callback API 写 `callback` + `isExplicitPost` | `callbacks.ts:~1008/1631` |
| 隔离执行（被动注入） | `ContextBuilder` + `VisibilityPolicy` | `route-helpers.ts:728` `assembleIncrementalContext()` |
| 隔离执行（主动拉取） | `get_thread_context` → `ContextBuilder` | `callbacks.ts:1999/2266/2341` 三端点 |
| 模式开关 | `ThreadStore` `mode` | `RedisThreadStore` `thinkingMode` |
| 路由入口 | `MentionParser` + `A2ARoutingPolicy` | `a2a-mentions.ts` + `enqueueA2ATargets` |
| 路由执行 | `CommunicationService` + `WorklistRegistry` | `routeSerial` / `routeParallel` |
| 广播出口 | `EventBus` / SSE | `SocketManager.broadcastAgentMessage` |
| 前端分桶 | Phase 6 通道语义 | `bubble-projection.ts` + `#814` |
| 可见性基线 | `VisibilityPolicy` | `visibility.ts` `canViewMessage` |

---

## 附：猫咖隔离数据流（文字版）

```
被调用猫(CLI子进程)
  │ NDJSON stdout
  ▼
toStreamEvent() ──打标 origin:'stream'──┐
                        │                                 │
                        ▼                                 ▼
            broadcastAgentMessage            猫主动 MCP post_message
            (operator UI 可见,                → origin:'callback'
             渲染成 CLI Output 气泡)           + isExplicitPost:true
                        │                                 │
                        ▼                                 ▼
              └──  MessageStore (全量保留 origin)  ──┘
                        │
                        ▼ 下一只猫被 A2A 触发
           assembleIncrementalContext()   ← 隔离执行点
           play 模式: m.origin==='stream' 且他猫 → return false
           → 只有 origin:'callback' 进入下一只猫的 prompt = "出现在聊天室"
```

对照 TheTower 的等价流：`AgentRunner` 产出 `agent_stream` → `MessageStore` 持久化 → `EventBus` 广播给 UI（operator 可见）→ 下一只 Agent 运行前 `ContextBuilder.buildForAgent` 装配可见上下文，`VisibilityPolicy` 在 play 模式下过滤他猫 `agent_stream` → 只有 `agent_final` / `callback` / `public` 消息进入下一只 Agent 的 prompt。
