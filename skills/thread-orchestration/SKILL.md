---
name: thread-orchestration
description: >
  TheTower thread 协作和 A2A 路由基础协议。所有 Agent 默认启用。
  Use when: 任意 Agent 在 thread 中回复、接力、收束或解释上下文。
  Not for: 无。
  Output: 符合 thread 路由协议的回复。
triggers:
  - "always"
---

# Thread Orchestration

你在 TheTower 的同一个 thread 中协作。thread 是协作真相源：用户消息、Agent 发言、callback 写回、A2A 交接都会落到同一条时间线。

## 核心原则

| 原则 | 含义 |
| --- | --- |
| Thread first | 不私下假装调用队友；需要队友行动就写入 thread |
| 明确球权 | `@handle` 是把下一步交给对方，不是装饰 |
| 少路由 | 能自己收束就不要继续 @ |
| 可复盘 | 每次交接都应让用户看得懂为什么轮到下一位 |
| 不伪造 | 只能代表自己发言，不能替其他 Agent 写“他说了” |

## 路由事实

- `@handle` 是球权转移信号。
- 只有行首 mention 会触发路由，例如：`@ikora 请 review 这个实现。`
- 句中 mention 只作为普通文字，不承担路由含义。
- 多个 Agent 分别行动时，使用多行行首 mention。
- 不要在确认、致谢、总结、已完成这类消息中继续 mention。
- 不要伪造其他 Agent 的发言。

## 回复前四问

回复前先判断：

1. 任务是否已经在你这里结束？
2. 如果没有结束，下一位需要行动的 Agent 是谁？
3. 如果这是接力、评审、实现链路或多人流程，是否需要把球传给下一棒？
4. 如果你是最后一棒，且原始任务要求发起者汇总或收束，是否需要交回发起者？

## 决策表

| 当前情况 | 正确动作 | 错误动作 |
| --- | --- | --- |
| 你能直接完成 | 给出结果，不 @ | 为了礼貌 @ 发起者“收到” |
| 需要某个 Agent 做具体下一步 | 行首 @ + 具体动作 | 句中提到对方但不交代动作 |
| 需要多个 Agent 各自行动 | 多行行首 @，每行一个任务 | 一句话里堆多个 @ |
| 接力任务还没结束 | 完成自己部分后传下一棒 | 输出自己部分后停住 |
| 原任务要求协调者汇总 | 完成后交回协调者 | 自己擅自最终总结 |
| 对方交接不清楚 | 指出缺口，必要时 push back | 猜测对方真实意图 |

## 正确示例

```md
我完成了数据库方案的初版拆分，核心表是 threads / messages / invocations。

@ikora 请 review 这个方案的上下文边界，重点看 message visibility 是否足够支撑后续 play mode。
```

## 错误示例

```md
@ikora 收到。
```

问题：这是确认，不是任务，会造成无意义 ping-pong。

```md
我觉得可以让 @ikora 看看。
```

问题：句中 mention 不路由，且没有明确 Next Action。

## 收束规则

- 任务完成：直接给出结论，不要继续 @mention。
- 任务未完成但需要他人继续：使用 `cross-agent-handoff` 五件套。
- 需要用户确认：说明需要用户决定的问题，不要假装已经完成。

## 和其他 Skills 的关系

- 需要交给其他 Agent：使用 `cross-agent-handoff`。
- 被其他 Agent 交接唤醒：使用 `receive-handoff-grounding`。
- 当前 worklist 末尾准备收束：使用 `quality-gate`。
- 要请别人审查：使用 `request-review`。
