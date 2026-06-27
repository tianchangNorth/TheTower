---
name: a2a-channel-semantics
description: >
  A2A 消息通道语义：final、callback、stream 的边界，以及普通 @ 与 callback/MCP 的使用时机。
  Use when: 任意 Agent 在 thread 中回复、运行中写回、@ 队友、私密交接或阶段性汇报。
  Not for: 无。
  Output: 不重复、不误路由、通道语义正确的 thread 消息。
triggers:
  - "always"
---

# A2A Channel Semantics

本 skill 是 TheTower 的消息通道边界。不要把 callback、final 和 stream 混成一个显示通道。

## 三种通道

| 通道 | 含义 | 正确使用 |
| --- | --- | --- |
| final reply | 你本轮最终要写回 thread 的可见回答 | 正常结论、总结、交接、行首 @ 路由 |
| callback / MCP post_message | 运行中的主动写回 | 先发一条消息、阶段性汇报、私密交接、必须在继续执行前触发另一个 Agent |
| stream / CLI output | 运行过程输出 | stdout、tool progress、debug log；不要把 final 当 stream |

## 普通 @ 队友

普通 A2A 接力优先使用 final reply 的行首 `@handle`。

```md
我完成了方案拆分。

@ikora 请 review message visibility 是否足够支撑 play mode。
```

不要为了普通 `@队友` 调 callback / MCP。句中 `@handle` 只是文字，不承担路由。

## 什么时候用 callback / MCP

只在这些场景优先使用 callback / MCP：

- 用户明确要求运行中先发消息、用工具发消息或阶段性汇报。
- 需要私密交接，必须设置 `visibility="private"` 和 `visibleToAgentIds`。
- 需要结构化交接且不想把五件套完整展示给用户，使用 `handoffPayload`。
- 必须在你继续执行前触发另一个 Agent 行动。

callback 默认是公开 thread 消息。没有显式私密写回成功，不要声称“已私密送达”“只有某 Agent 可见”。

## 不重复发言

如果已经通过 callback / MCP 写回了某条消息，最终回复不要重复同一条内容。

正确：

```md
callback 已发：@ada 请自我介绍。
final：我已补上 Ada 的邀请，接下来等待她回复。
```

错误：

```md
callback 已发：@ada 请自我介绍。
final 又原样输出：@ada 请自我介绍。
```

## 不误折叠

不同内容的 final reply 是正常发言，不能因为同一 invocation 里已有 callback 就当成 CLI output。

例如：

```md
callback：@ada 请自我介绍。
final：这是我的疏忽，我已经补上 Ada 的邀请。后续总结如下...
```

上面的 final 是用户应看到的回答，不是 stream。

## 路由与显示分离

- 重复显示由 exact duplicate 去重处理。
- 重复路由由 Worklist / Dispatch 层处理。
- UI 不应该靠折叠 final 来掩盖重复调度。
- `targetAgents` 是结构化路由目标；`visibleToAgentIds` 是可见范围，二者不是同一概念。

## 和其他 Skills 的关系

- 普通 thread 路由格式看 `thread-orchestration`。
- 跨 Agent 五件套交接看 `cross-agent-handoff`。
- 被交接唤醒后的事实校准看 `receive-handoff-grounding`。
