# 猫咖（clowder-ai）Skill 与 MCP 工具差距分析与补充建议

> 来源：对比 `/Users/xuchenyang/ai/clowder-ai` 的 `cat-cafe-skills/manifest.yaml` 与 `packages/mcp-server/src/tools/`。
> 立场：TheTower 当前定位是**多 Agent A2A 协作内核 MVP**（已实现 callback、worklist 接力、A2A 防护、SSE、invocations 表）。
> 原则：不照搬猫咖。猫咖大量 skill 面向内容生产/金融/媒体场景，与 TheTower 无关；只补直接服务于协作内核的项。

## 一、现状基线

### TheTower 已有 Skills（9 个，见 `skills/manifest.yaml`）
- `a2a-channel-semantics` — stream/callback 通道语义（TheTower 独有，优于猫咖等价物）
- `thread-orchestration` — thread 协作与 A2A 路由基础协议
- `cross-agent-handoff` — 跨 Agent 交接五件套（对应猫咖 `cross-cat-handoff`，命名不同但等价）
- `receive-handoff-grounding` — 接球校准
- `quality-gate` — worklist 收束自检门禁
- `request-review` / `receive-review` — review 请求/接收
- `context-self-management` — 上下文自管理
- `multi-agent-round-robin` — 多 Agent 轮询（TheTower 独有）

### TheTower 已有 MCP 工具（`packages/mcp-server/src/tools/`）
- `file-tools` / `shell-tools` / `callback-tools` / `result`
- 顶层：`server-toolsets.ts` / `index.ts`（注册 `buildCollabTools` / `buildWorkspaceTools` / `buildFullTools`）

### 猫咖规模参考
- Skills：~50 个（manifest 注册）
- MCP 工具：28 个 tool 文件 + 8 个顶层 src 模块

---

## 二、第一档：强烈建议补（直接强化协作内核）

ROI 最高，全部直接服务于 A2A 协作内核，建议优先落实。

### Skills

| Skill | 现状缺口 | 补齐价值 |
|---|---|---|
| `merge-gate` | 已有 request/receive-review，缺**合并/发布收尾门禁** | 开发链闭环：worklist 最后一位自称完成时，提供等同于 quality-gate 但面向"合并/发布"的闸口 |
| `organize-threads` | thread 是 TheTower 核心数据结构，但无归档/拆分/收束规范 | thread 变长变乱后的治理 SOP |
| `cross-thread-sync` | 已有同 thread 内 `cross-agent-handoff`，缺**跨 thread 协同** | 多 thread 场景下的传话/同步协议 |
| `collaborative-thinking` | 缺思考协议 | 何时发散/收束/质疑，与 round-robin、expert-panel 互补 |
| `expert-panel` | 已有 `multi-agent-round-robin`（轮询），但不是**辩论** | 多视角对抗后裁决的模式，比轮询更高阶 |

> **Round 1 落地结果（2026-07-03）**：经核查 TheTower 现有能力，5 个 skill 中仅 2 个协议层可本轮落地——`collaborative-thinking`、`expert-panel` 已建 SKILL.md 并入 manifest（见 `skills/`）。其余 3 个被基础设施阻塞，**本轮暂缓**：
> - `merge-gate`：阻塞于无 `pnpm gate` / PR / cloud review / guardian 基础设施（`skills/quality-gate/SKILL.md` 仅软自检）。待 git/CI 流程层建立后再评估。
> - `organize-threads`：阻塞于 threads 表无 label/tag 列（`packages/api/src/db/schema.ts:19-27`），且无 `list_threads` MCP。待 label 系统 + 线程查询 MCP 上线后再评估。
> - `cross-thread-sync`：阻塞于无跨 thread 投递（`CommunicationService.postAgentMessage` 锁定 `invocation.threadId`），无 `cross_post` MCP。待跨 thread 投递能力上线后再评估。
>
> 另：两 skill 的"多 Agent 并行独立"阶段（collaborative-thinking Mode B、expert-panel Independent）受限于 `executeWorklist` 串行执行（无 `Promise.all`，`fanout/parallel` routeMode 只改 prompt 文案），已在 SKILL.md 内标 TODO，待并行 dispatch 上线后启用。
> 附带发现：`skills/multi-agent-round-robin/` 是空目录、未进 manifest，是独立遗留问题，不在本次范围。

### MCP 工具

| 工具 | 现状缺口 | 补齐价值 |
|---|---|---|
| `session-chain-tools` | 已有 `invocations` 表记录调用链，但 Agent 侧无查询入口 | Agent 可自检"被谁、在什么链路里唤醒"，强化 A2A 可观测性 |
| `callback-retry` | 已有 `callback-tools`，缺失败重试/退避 | callback 是 TheTower 生命线，可靠性必须补 |
| `callback-outbox` | callback 直投，无落盘缓冲 | "先落盘再投递"，避免 callback 丢失，提升内核健壮性 |

> 注：`recent-tools` 与 `event-memory-tools` 原列于此，经源码核查后移除——见第五节"不建议补"。

---

## 三、第二档：建议补（补齐开发链与治理）

按开发需要滚动补，非阻塞第一档。

### Skills
- `writing-plans` — 计划编写，配合 `worktree` 形成完整开发链
- `tdd` — 测试驱动，猫咖核心开发 skill
- `debugging` — 调试 SOP
- `worktree` — 隔离开发；TheTower 是 monorepo，worktree 价值大
- `self-evolution` — 自我进化，契合"塔"隐喻
- `vision-rescue` — 绝境反转，处理 Agent 卡死/死循环

> **Round 2 落地结果（2026-07-03）**：第二档 6 个 skill **全部已落地**（`skills/` 下建 SKILL.md 并入 manifest）。第二档偏方法论，不像第一档被基础设施硬阻塞，裁剪后均可移植：
> - `writing-plans` / `tdd` / `debugging` / `vision-rescue`：协议近乎全保留。tdd 例子从 pytest 换成 vitest/node:test；debugging 的 runtime preflight 通用化；各 skill 的 `search_evidence` recall 标 TODO（TheTower 暂无语义检索 MCP，靠 auto-memory + `read_file`）。
> - `worktree`：精简版，只留隔离/main 同步/创建清理/CWD 护栏核心；猫咖的 Redis 端口隔离 / sidecar / runtime 生产守卫等专有设施剔除（TheTower 不适用）。
> - `self-evolution`：Mode A（Scope Guard）完整 / Mode B（Process Evolution）协议完整、沉淀改写 auto-memory / Mode C（Knowledge Evolution）的 Episode Card / Dual Distillation / Eval Ledger / 五级阶梯重设施标 TODO，当前降级为 auto-memory `reference`/`feedback` 沉淀。
>
> 优先级：worktree 58 / writing-plans 55 / tdd 40 / debugging 40 / self-evolution 35 / vision-rescue 30。next 链：worktree→tdd/writing-plans，writing-plans→worktree/tdd，tdd/debugging→quality-gate，vision-rescue→collaborative-thinking/self-evolution。

### MCP 工具
- `callback-memory-tools` — callback 记忆维度，与 event-memory-tools 互补
- `publish-verdict-tool` — 裁决发布，配合 expert-panel
- `perspective-tools` — 视角管理，配合 collaborative-thinking
- `distillation-tools` — 长 thread 蒸馏/摘要，thread 变长后必备
- `degradation` — 降级策略，Agent 调用失败时优雅退化

---

## 四、第三档：可选（看场景再补，不急）

### Skills
- `feat-lifecycle` / `code-as-harness` — 偏重型开发流程，MVP 阶段暂不急
- `memory-navigation` / `memory-search-best-practices` — TheTower 已有 auto-memory 机制，需评估是否重复
- `deep-research` / `source-audit` / `open-source-teardown` — 调研类，看是否做这类功能
- `rich-messaging` / `console-dev` / `browser-preview` — 前端交付类，等 web 端做深再说
- `schedule-tasks` / `hyperfocus-brake` / `incident-response` — 运维类，非核心

### MCP 工具
- `library-lifecycle-tools` / `evidence-tools` / `evidence-coverage-nudge` — 证据/库管理，偏重
- `signals-tools` / `signal-study-tools` — 猫咖金融场景，TheTower 用不上
- `audio-tools` / `finance-tools` / `game-action-tools` / `limb-tools` / `hub-action-tools` — 猫咖特定域
- `rich-block-rules-tool` / `cross-post-suggestion-format` — 看富媒体需求

---

## 五、不建议补（与 TheTower 无关或已有更优版本）

- 媒体生成类：`video-forge` / `anime-forge` / `image-generation` / `ppt-forge` / `pencil-design`
- 金融/信号：`ttfund-skills` / `signals-*` / `finance-*`
- 引导类：`guide-authoring` / `guide-interaction` / `bootcamp-guide`（除非 TheTower 要做用户引导）
- 企业 IM：`enterprise-workflow`
- `a2a-channel-semantics` 已是 TheTower 独有的更优版本，**不要用猫咖等价物覆盖**
- `recent-tools`（`cat_cafe_list_recent`）— **待知识库层建立后再评估**。源码核查：它包装 `/api/library/recent`，查的是知识库条目（decision/lesson/plan/trajectory 等），并非 thread 消息；服务于"零先验冷启动浏览"场景，是猫咖 7 工具记忆家族的一员（与 `search_evidence` / `graph_resolve` 同族）。TheTower 当前只有 thread/invocation/callback 表，**没有独立的 library/知识沉淀层**，此工具无东西可查。若未来 TheTower 建立知识库层（把 thread 收束成 decision/lesson 落库），应作为"记忆导航"族整体设计，而非单点补。
- `event-memory-tools`（`cat_cafe_list_events` / `teleport` / `backfill_events`）— **待认知转换事件索引层建立后再评估**。源码核查：它查的不是原始消息或 SSE 推送事件，而是一层**派生的认知转换索引**——从消息里抽取的 brake（用户/agent 踩刹车）/ aha / 自检沉淀 / magic-word 触发等标记，过滤维度是 `trigger`/`type`/`cognitiveTransition`/`confidence`。agent 上下文只有当前 thread 近期原始消息，看不到这层派生标注、跨 thread 历史、结构化过滤——这是它不与 context 重叠的原因。TheTower 当前**没有这层认知转换索引**（SSE 是 push-only 不持久化为可查索引；`messages`/`invocations` 表是原始数据），其查询对象被已有的 `get_thread_context`（当前 thread 消息）+ 第一档 `session-chain-tools`（invocation 链）覆盖，无独立查询对象。若未来 TheTower 建立认知转换事件索引层（标注 brake/aha/自检事件并持久化），再补此工具。

---

## 六、落实优先级与下一步

### 推荐落地顺序
1. **第一批**：第一档 5 skill + 3 MCP 工具，全部直接服务协作内核
2. **第二批**：第二档按开发需要滚动补
3. **第三档**：按场景再说

### 移植注意事项
- Skill 移植需同步更新 `skills/manifest.yaml`（触发规则、next 链、output 契约）
- MCP 工具移植需在 `packages/mcp-server/src/server-toolsets.ts` 注册到对应 toolset（collab / workspace / full）
- 猫咖 skill 中的 `cross-cat-handoff`、`cat-cafe` 等命名需替换为 TheTower 术语（`cross-agent-handoff`、agent 等）
- 移植前先读对应 `SKILL.md` 与 `.ts` 实现，确认依赖是否在 TheTower 已具备

### 待决策项
- `merge-gate` 与现有 `quality-gate` 的边界划分（合并门禁 vs 收束自检）
- `expert-panel` 与现有 `multi-agent-round-robin` 是否合并或分层
- `callback-retry` / `callback-outbox` 是否复用现有 `callback_tokens` 表还是新建 outbox 表
