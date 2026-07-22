# A2A 输出隔离结构性升级 — 分步开发文档

> 参考猫咖 clowder-ai 隔离数据流模型，对 TheTower 做结构性升级。
> 总方案见 `~/.claude/plans/inherited-prancing-wand.md`，对比背景见 [a2a-routing-output-isolation-comparison.md](./a2a-routing-output-isolation-comparison.md)。
>
**目标模型**：runner stdout（thinking/tool/最终文本）全部降为 `agent_stream` 私有通道；公开发言唯一走 `callback`（post_message）；无兜底；消除 `agent_final` origin；默认 `ThreadMode=play`；thinking 任何模式下都不跨 Agent 共享。

---

## 进度总览

> **当前结论（2026-07-22）**：R0.8 已正式通过。验收工具、历史库副本演练和 stream 量级观测已实现，Mock/fixture 自动化及 Codex、Claude 真实外部模型验收全部通过。

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| Phase 1 数据模型 + 默认 play + migration | ✅ 已完成 | 代码改完，构建通过 |
| Phase 2 Runner 流式 + stream 落库 | ✅ 已完成 | 代码改完，ClaudeCliRunner 测试通过 |
| Phase 3 VisibilityPolicy + 前端投影 | ✅ 已完成 | 代码改完，web typecheck 通过 |
| Phase 4 Skills / Prompt 重写 | ✅ 已完成 | 代码改完 |
| Phase 5 验证与上线验收 | ✅ 已完成 | 自动化、migration rehearsal、stream observer 及真实 Codex/Claude 报告全部通过 |

**完成度口径**：开发项 100%；本地自动化验证 100%；外部真实 Runner 上线验收 100%。

**最近验证（2026-07-13）**：全仓 unit 153/153 ✅、integration 3/3 ✅、lint ✅、production build ✅。首次 Web build 因受限沙箱禁止 Turbopack 临时绑定端口而失败，在允许该构建行为的环境中重跑后通过，非代码失败。

---

## Phase 1：数据模型 + 默认 play + migration ✅

- [x] `packages/shared/src/index.ts`
  - `MessageOrigin` 删除 `"agent_final"`，保留 `user | agent_stream | callback | tool | system | briefing`
  - `MessageExtra.stream` 加 `chunkType?: "thinking"|"text"|"tool_call"|"error"`、`toolName?`、`chunks?: Array<{chunkType,content,toolName,createdAt}>`
  - `AgentEvent`：`thinking` 的 content 改可选；新增 `{type:"stream_text";content}`
- [x] `packages/api/src/db/schema.ts`
  - `threads.mode DEFAULT 'play'`，`ensureColumn` mode 定义改 `DEFAULT 'play'`
  - 加 `schema_migrations` 表 + `ensureMigration` 钩子；migration v1：`agent_final` 消息转 `callback`（`isExplicitPost=false`）+ 现有 thread mode 升 `play`
- [x] `packages/api/src/stores/ThreadStore.ts` — 4 处 `??"debug"`→`"play"`
- [x] `packages/api/src/stores/MessageStore.ts` — `inferOrigin` 返回 `"agent_stream"`
- [x] `packages/api/src/context/ContextBuilder.ts` — 默认 mode→`"play"`
- [x] `packages/api/src/services/CommunicationService.ts` — `postUserMessage` 新建 thread mode→`"play"`、`getThreadMode` fallback→`"play"`
- [x] `packages/api/src/routes.ts` — L597/710 `??"debug"`→`"play"`
- [x] `packages/api/src/routing/WorklistRegistry.ts` — `A2ARouteMessageOrigin` 收窄为 `"callback"`
- [x] `packages/shared/src/index.ts:157` `triggerOrigin` 类型随之收窄

## Phase 2：Runner 流式 + CommunicationService stream 落库 ✅

- [x] `packages/api/src/agents/runners/ClaudeCliRunner.ts`
  - `run()` 改为 `for await (const line of readLines(child.stdout))` 逐行流式
  - 新增 `parseClaudeStreamLine(line, {onAssistantText})` 生成器：`content_block_delta` text_delta→`stream_text`、thinking_delta→`thinking`；`assistant` content blocks：tool_use→`tool_call`、thinking→`thinking`、text→累计；`result`→`token_usage` + `text`（有 result string 时）
  - 新增 `readLines`（readline 封装）；保留 `parseClaudeStreamJson`/`extractClaudeUsage` 给测试
  - exit 后若未 yield 过 text 且有 assistantText，补一条 `text`
- [x] `packages/api/src/agents/runners/CodexCliRunner.ts`
  - stdout 逐行流式 yield `stream_text`；exit 后 `readOutput(outputFile)` yield `text`
  - 加 `readLines`
- [x] `packages/api/src/agents/runners/MockRunner.ts`
  - yield `thinking` + `stream_text` + `text` + `token_usage` + `done`，**不调 post_message**
- [x] `packages/api/src/services/CommunicationService.ts`
  - `handleAgentEvent` 重写：`text`/`stream_text`/`thinking`/`tool_call` → 新增 `postStreamChunk`（写 `origin:"agent_stream"` + `extra.stream.{invocationId,chunkType,toolName}`，`mentions:[]`，**不 push worklist**）；`text` 标 `speechContent`
  - **删除** `postInternalAgentText`、`findInvocationCallbackSpeech`
  - 新增 `summarizeToolInput` helper；保留 `findExactCallbackDuplicate`（callback↔callback 去重）
  - **决策**：`text`/`stream_text` 均只写 `agent_stream`；不解析 A2A mention、不 push worklist；不存在隐式 callback 兜底
  - stream 按 `(threadId, invocationId, senderId)` 合并为一行；thinking/stdout/tool event 共用该行并分别保留

## Phase 3：VisibilityPolicy 强化 + 前端投影 ✅

- [x] `packages/api/src/context/VisibilityPolicy.ts`
  - play 模式 agent_stream 过滤（原有 dead code）随 producer 上线自动复活
  - 新增：`message.extra?.stream?.chunkType === "thinking"` 任何模式下仅自己可见（debug 也私有）
- [x] `packages/web/src/messageProjection.ts`
  - `getExactDuplicateKey` 改为只对 `origin==="callback"` 去重；agent_stream 不去重
  - `shouldPreferIncomingDuplicate` 改用 `extra.isExplicitPost` 优先（true 优先 false）
  - 新增 `groupStreamChunks`：按 `(invocationId, senderId)` 聚合 agent_stream 为一条合成 Message，`extra.stream.chunks` 带 chunk 列表
  - fallback origin → `agent_stream`
- [x] `packages/web/src/components/command/MessageBubble.tsx`
  - 新增 `StreamOutput` 组件：聚合 stream 渲染为 `CLI Output · N chunks` 折叠时间线，按 chunkType 列 thinking/tool_call/text
  - 删除 `agent_final` 分支；callback 走普通公开气泡
- [x] `packages/web/src/lib/messageAudit.ts` — `getMessageOrigin` fallback→`agent_stream`；加 `stream` 计数与匹配
- [x] `packages/web/src/types.ts` — `MessageAuditFilter` 加 `"stream"`（label "CLI Output"）

## Phase 4：Skills / Prompt 重写 ✅

- [x] `skills/a2a-channel-semantics/SKILL.md` — 重写为二通道模型（stream 私有 / callback 公开）；铁律：stdout 不自动公开、要发言必须 post_message、路由只走 callback、不在公开 callback 复述私密内容或元数据、Quality Gate 不贴公开 callback
- [x] `skills/quality-gate/SKILL.md` — 加"输出通道"节：完整 Quality Gate 进 stdout 或私密 callback+handoffPayload，公开 callback 只给结论
- [x] `skills/manifest.yaml` — a2a-channel-semantics description 更新，消除 final 字样
- [x] `packages/api/src/agents/runners/CliPromptBuilder.ts` — S3 铁律改写：stdout 私有、要公开发言必须 post_message、A2A 路由只走 callback

---

## Phase 5：验证与上线验收 ✅

### 5.1 自动化验证 ✅ 已完成

重点回归均已修复并验证通过：
- [x] `CliPromptBuilder.test.ts` — message-2 origin `agent_final`→`callback`；3 个测试通过
- [x] `ClaudeCliRunner.test.ts` — 流式解析、主流程、workingDirectory、error、abort 全部通过；abort 路径未挂起
- [x] `CodexCliRunner.test.ts` — 主流程、sandbox、network proxy、workingDirectory、error 全部通过
- [x] `CommunicationService.test.ts` — 重写 3 个 `postInternalAgentText` 测试为 stream 模型（stream 与 callback 共存不去重、stream 不路由）；fanout/serial 断言改 unique senderId
- [x] `MessageStore.test.ts` — legacy origin 断言 `agent_final`→`agent_stream`
- [x] `ContextBuilder.test.ts` — fixture origin `agent_final`→`agent_stream`
- [x] `VisibilityPolicy.test.ts` — fixture origin `agent_final`→`agent_stream`；新增 thinking 跨 Agent 不可见（debug 也私有）测试
- [x] web `messageProjection` 回归通过，thinking 与 CLI stream output 均保留
- [x] 重点 API 回归 59/59 通过
- [x] `pnpm test:unit` — 153/153 通过（API 108、MCP Server 11、SDK 19、Web 15）
- [x] `pnpm test:integration` — 3/3 通过
- [x] `pnpm lint` — 全仓通过
- [x] `pnpm build` — shared、MCP Server、API、SDK、Web production build 全部通过

### 5.2 真实 Runner e2e

- [x] 提供 `pnpm test:e2e:real`：临时 Workspace/DB、真实 MCP callback、play/debug 自动断言与 JSON 证据
- [x] 覆盖 stdout 仅 stream、显式 public/private callback、非接收者隔离、play 隐藏、debug thinking redaction
- [x] 运行 Codex 真实验收：`terminalStatus=done`，11/11 checks 通过，stream 单行 891 bytes、无预算超限
- [x] 运行 Claude 真实验收：`terminalStatus=done`，11/11 checks 通过，stream 单行 1,047 bytes、无预算超限

### 5.3 上线前检查

- [x] migration rehearsal 使用 SQLite backup 副本验证 `agent_final→callback`、`debug→play`、源库不变和二次执行幂等
- [x] stream observer 统计行数、payload、P95/最大值和阈值违规；250 stdout + 50 thinking chunk 回归保持单行

---

## 文件级改动清单（已完成代码改动）

| # | 文件 | 改动要点 | 阶段 |
| --- | --- | --- | --- |
| 1 | `packages/shared/src/index.ts` | MessageOrigin 删 agent_final；MessageExtra.stream 加 chunkType/toolName/chunks；AgentEvent 加 stream_text + thinking.content 可选 | P1 |
| 2 | `packages/api/src/db/schema.ts` | threads DEFAULT play；ensureColumn mode→play；schema_migrations + migration v1 | P1 |
| 3 | `packages/api/src/stores/ThreadStore.ts` | 4 处 `??"debug"`→`"play"` | P1 |
| 4 | `packages/api/src/stores/MessageStore.ts` | inferOrigin 返回 agent_stream | P1 |
| 5 | `packages/api/src/context/ContextBuilder.ts` | 默认 mode→play | P1 |
| 6 | `packages/api/src/context/VisibilityPolicy.ts` | thinking chunk 永不跨 Agent 规则 | P3 |
| 7 | `packages/api/src/services/CommunicationService.ts` | handleAgentEvent 重写+postStreamChunk+summarizeToolInput；删 postInternalAgentText/findInvocationCallbackSpeech；默认 play | P2 |
| 8 | `packages/api/src/agents/runners/ClaudeCliRunner.ts` | 逐行流式 yield；新增 parseClaudeStreamLine/readLines | P2 |
| 9 | `packages/api/src/agents/runners/CodexCliRunner.ts` | stdout 逐行流式 yield；新增 readLines | P2 |
| 10 | `packages/api/src/agents/runners/MockRunner.ts` | yield stream_text+text，不 post_message | P2 |
| 11 | `packages/api/src/agents/runners/CliPromptBuilder.ts` | S3 铁律改写 | P4 |
| 12 | `packages/api/src/routing/WorklistRegistry.ts` | A2ARouteMessageOrigin 收窄为 callback | P1 |
| 13 | `packages/api/src/routes.ts` | L597/710 `??"debug"`→`"play"` | P1 |
| 14 | `packages/web/src/messageProjection.ts` | 去重 callback-only + isExplicitPost；新增 groupStreamChunks | P3 |
| 15 | `packages/web/src/components/command/MessageBubble.tsx` | StreamOutput 聚合渲染；删 agent_final 分支 | P3 |
| 16 | `packages/web/src/lib/messageAudit.ts` | getMessageOrigin fallback→agent_stream；加 stream filter | P3 |
| 17 | `packages/web/src/types.ts` | messageAuditFilters 加 stream | P3 |
| 18 | `skills/a2a-channel-semantics/SKILL.md` | 重写为二通道模型 | P4 |
| 19 | `skills/quality-gate/SKILL.md` | 加输出通道规则 | P4 |
| 20 | `skills/manifest.yaml` | a2a-channel-semantics description 更新 | P4 |

---

## 关键决策记录

1. **A2A 路由只从 callback 触发**：stream text 不解析 @mention、不 push worklist。stdout 是私有通道，路由属公开发言范畴，应来自 callback。比猫咖原始实现（stream 解析 @mention 但内容对他者私有）更干净——接球方能实际看到请求内容。
2. **无兜底**：agent 不 post_message → thread 公共区无回复。MockRunner 不再产出公开发言。
3. **旧 `agent_final` 消息迁移为 `callback`（isExplicitPost=false）**：保持公开气泡语义。
4. **thinking 在 debug 也私有**：debug 透明只针对普通 stream text/tool_call。operator 前端仍全可见。
5. **stream 与 callback 不去重**：stream 是私有通道，callback 是公开通道，二者共存不抑制。callback↔callback 精确去重保留。

## 关键风险

1. **stream payload 增长**：chunk 已合并为每 invocation+agent 一行，不再按行爆量；单行 JSON/text 仍会增长，默认以 1 MiB 阈值观测。
2. **无兜底致空回复**：agent 偶发不调 post_message 时 thread 公共区空白。靠 skill 强约束 + operator 可看 CLI Output 缓解。
3. **migration 不可逆**：agent_final→callback 单向。上线前 backup db。
4. **真实环境验收尚未完成**：自动化回归已通过，但私密 callback 可见性、play/debug 上下文隔离仍需按 5.2 在真实 Agent 链路中确认。
