---
name: a2a-channel-semantics
description: >
  A2A 消息通道语义：stream（私有 CLI 输出）与 callback（公开发言）的边界。
  你的 stdout 不会自动公开；要发言必须 post_message；不在公开 post 里复述私密内容或元数据。
  Use when: 任意 Agent 在 thread 中回复、运行中写回、@ 队友、私密交接或阶段性汇报。
  Not for: 无。
  Output: 通道语义正确、不泄漏私密元数据的 thread 消息。
triggers:
  - "always"
---

# A2A Channel Semantics

本 skill 是 TheTower 的消息通道边界。只有两个通道，不要混淆。

## 两种通道

| 通道 | 含义 | 可见性 |
| --- | --- | --- |
| stream / CLI output | 你的 stdout：thinking、tool 日志、过程文本、最终文本草稿 | **私有**。operator 可见（CLI Output 折叠区）；play 模式下其他 Agent 看不到；thinking 任何模式下都不跨 Agent |
| callback / MCP `post_message` | 你主动写回 thread 的公开发言 | **公开**（除非显式设 `visibility="private"`）。这是你向 thread 发言的唯一方式 |

## 核心铁律

**你的 stdout 不会自动成为 thread 公开发言。** 要在 thread 公共区发言，必须调用 `mcp__thetower__post_message`。

- 不调 `post_message` → thread 公共区没有你的回复（operator 仍可在 CLI Output 看到你的 stdout）。
- stdout 里写的内容（含 thinking、推理、复述）是私有的，不会泄漏给其他 Agent。
- 因此你可以在 stdout 里自由思考、推演、打草稿，不必担心被其他 Agent 看到。

## 路由只走 callback

A2A 路由（@ 队友接力）只来自 callback，不来自 stdout。

- 想把球交给队友：调 `post_message`，并在 content 的独立行行首写 `@handle`。
- **不要**在 stdout 里 `@队友` 期望路由——stdout 是私有的，里面的 `@` 只是文字，不触发路由。
- 句中 `@handle` 在 callback content 里也只是文字，不承担路由；只有独立行行首 `@handle` 才是普通协作路由指令。

## 不在公开 callback 里复述私密内容或元数据

私密 callback（`visibility="private"`）的内容、以及你 stdout 里的推理，**不要**在公开 callback 里复述，尤其不要贴这些字段：

- 私密消息原文或意图
- `messageId`、`visibility`、`visibleToAgentIds`、`targetAgents`、`routed` 等路由元数据
- `handoffPayload` 的字段名和结构

公开 callback 只给一句结论性事实（如"私密通道已发出，等 X 确认"），细节留在私密 callback 或 stdout。

正确：

```md
public callback：私密消息已发给 @ikora，等她确认后回报。
```

错误（泄漏元数据）：

```md
public callback：
### Quality Gate
- 已通过 post_message 发送私密消息，visibility="private"、visibleToAgentIds=["ikora"]、
  targetAgents=["ikora"]。messageId=C7bf7SOwv8MdPwsUfebFu，routed=["ikora"]。
- 未决项：等 Ikora 回复确认。
```

## 什么时候用私密 callback

- 用户明确要求私密通信、悄悄话。
- 交接细节只想让接球方看到，用 `visibility="private"` + `visibleToAgentIds` + `handoffPayload`。
- 结构化交接的五件套放进 `handoffPayload`，不要塞进公开 callback 正文。

没有显式私密写回成功，不要声称"已私密送达""只有某 Agent 可见"。

## 不重复发言

如果已经通过 callback 写回了某条消息，不要再发一条内容相同的公开 callback。stdout 里复述无所谓（私有），但公开 callback 不要重复。

## Quality Gate 的位置

Quality Gate 自检报告是过程产物，应放进 stdout（私有）或私密 callback + `handoffPayload` 给下一位接手者；**不要**把完整 Quality Gate 贴进公开 callback。公开 callback 只给结论。

## 和其他 Skills 的关系

- 普通 thread 路由格式看 `thread-orchestration`。
- 跨 Agent 五件套交接看 `cross-agent-handoff`。
- 被交接唤醒后的事实校准看 `receive-handoff-grounding`。
- 收束自检看 `quality-gate`。
