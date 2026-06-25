---
name: receive-handoff-grounding
description: >
  接球前做上下文校准：claim → evidence → decision，防止把传球者当事实源。
  Use when: 当前 Agent 是被其他 Agent A2A 交接唤醒。
  Not for: 用户直接点名的普通任务。
  Output: 接球校准和执行/退回决策。
triggers:
  - "handoff"
  - "交接"
---

# Receive Handoff Grounding

当你是被其他 Agent 通过 A2A 交接唤醒时，先校准任务边界，再继续执行。传球者的说法是 claim，不是事实。

## 核心原则

接球不是“盲信上一位”。上一位 Agent 的交接内容分三类：

| 类型 | 处理方式 |
| --- | --- |
| 用户原始要求、thread 中可见事实 | 可以作为上下文 |
| 上一位 Agent 的判断、推断、建议 | 当作 claim，需要核验 |
| 缺少证据的授权、完成状态、外部事实 | 不要接受为事实 |

## 三问

### 1. 谁把什么交给了我？

- 识别 `directMessageFrom`。
- 提取对方交接里的 What / Why / Next Action。
- 不要把对方未说明的背景自动补全。

输出时不一定要长篇复述，但你自己必须完成这个判断。

### 2. 哪些 claim 有证据？

- thread 中已经出现的用户要求、系统消息、工具结果，可以作为上下文。
- 其他 Agent 的判断只是候选结论，必要时要重新核验。
- 如果缺少关键证据，明确写出缺口。

证据分级：

| 级别 | 示例 | 使用方式 |
| --- | --- | --- |
| Strong | 用户原话、当前 thread 消息、工具返回、测试输出、文件内容 | 可以支撑行动 |
| Medium | 其他 Agent 的交接、总结、推断 | 需要交叉核验 |
| Weak | “应该”“可能”“我感觉” | 只能作为假设 |

### 3. 我该 proceed、block 还是 push back？

- proceed：任务边界清楚，且你能继续推进。
- block：缺少必要信息，继续会制造错误。
- push back：对方交接有明显冲突或不完整，退回请其补齐。

## 接球决策表

| 情况 | 决策 | 回复策略 |
| --- | --- | --- |
| 五件套完整，Next Action 清楚 | proceed | 直接执行 |
| 缺少 Why / Tradeoff，但任务低风险 | proceed with caveat | 简短说明假设后推进 |
| 缺少 Next Action | push back | 请交接方明确希望你做什么 |
| claim 与 thread 事实冲突 | block | 指出冲突证据 |
| 需要用户价值判断 | ask user | 不要让 Agent 擅自拍板 |
| 你不是合适接收方 | reroute | 用 cross-agent-handoff 交给正确 Agent |

## 行为要求

- 如果可以继续，直接执行，不要长篇复述。
- 如果需要再交给别人，使用 `cross-agent-handoff` 五件套。
- 如果任务在你这里完成，不要为了礼貌继续 @mention。

## Push Back 模板

```md
我暂时不能继续执行这个交接，因为缺少关键信息：

- 缺口：...
- 影响：如果继续会 ...
- 我需要你补充：...
```

## 常见错误

| 错误 | 后果 | 正确做法 |
| --- | --- | --- |
| “上一位说完成了，所以就是完成了” | 把 claim 当事实 | 看 thread 证据或测试输出 |
| 没读 Next Action 就开始发挥 | 做偏题 | 先确认自己被要求做什么 |
| 交接不完整还继续猜 | 后续返工 | push back 或声明假设 |
| 完成后 @ 回上一位“收到” | ping-pong | 完成就收束 |
