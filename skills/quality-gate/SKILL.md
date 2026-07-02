---
name: quality-gate
description: >
  worklist 收束前的自检门禁：任务完成度、证据、未决项、是否需要继续路由。
  Use when: 当前 Agent 是最后一棒、声称完成、准备交付。
  Not for: 收到 review 反馈。
  Output: 简短质量检查和最终结论。
triggers:
  - "完成"
  - "交付"
  - "自检"
---

# Quality Gate

当你是当前 worklist 的最后一个 Agent，或你准备声称任务完成时，在回复前做一次交付检查。

## 核心原则

没有证据不要声称完成。没有必要动作不要继续路由。

## 触发场景

- 你是当前 worklist 最后一位。
- 你准备说“完成了”“已修复”“可以了”。
- 你准备把结论交给用户。
- 你准备请求 review。

不适用：

- 你只是中间一棒，还必须交给下一位。
- 你收到 review 反馈，应该先用 `receive-review`。

## 检查流程

### Step 1：回读原始请求

- 原始请求：用户真正要的是什么？
- 当前结果是否覆盖了这个请求？
- 是否只完成了一个中间步骤，却说成最终完成？

### Step 2：列出完成度

用三类表达：

| 状态 | 含义 |
| --- | --- |
| Done | 已完成，有证据 |
| Partial | 推进了，但还有明确剩余动作 |
| Blocked | 需要用户、工具、环境或其他 Agent |

### Step 3：附证据

按任务类型给证据：

| 任务类型 | 最低证据 |
| --- | --- |
| 代码改动 | 测试 / lint / build 输出，或说明未运行原因 |
| 调研 | 来源、文件、命令、关键依据 |
| 架构设计 | 方案边界、取舍、未决问题 |
| 前端体验 | 页面验证、截图或明确未验证 |
| A2A 协作 | 谁完成了什么，下一步是否需要继续 |

### Step 4：判断是否继续路由

- 任务完成：不要 @。
- 需要别人继续：使用 `cross-agent-handoff`。
- 需要用户拍板：问用户，不要交给 Agent 假装决策。

## 输出要求

- 任务完成：直接给出清晰结论和关键证据。
- 任务未完成但可交接：用 `cross-agent-handoff` 五件套。
- 需要用户确认：说明阻塞点和需要用户决定的问题。
- 不要用 `@mention` 做确认、致谢、收尾。

## 输出通道（重要）

Quality Gate 报告是过程产物，**不要**把完整 Quality Gate 贴进公开 callback。

- 完整 Quality Gate 报告写进你的 stdout（私有，operator 可见），或
- 通过 `post_message` 发 `visibility="private"` + `handoffPayload` 给下一位接手者，五件套放 `handoffPayload`。
- 公开 callback（给 thread 公共区）只给一句结论性总结，不要贴 `messageId` / `visibility` / `visibleToAgentIds` / `targetAgents` / `routeMode` 等路由元数据。

详见 `a2a-channel-semantics`。

## 简短报告模板

```md
### Quality Gate

- 原始请求：...
- 状态：Done / Partial / Blocked
- 证据：...
- 未决项：无 / ...
- 是否继续路由：否 / 是，交给 ...
```

> 上面这份完整模板写进 stdout 或私密 callback，不要原样贴进公开 callback。

## Block 场景

| 声称 | 为什么不够 |
| --- | --- |
| “应该可以了” | 没有证据 |
| “我看起来修好了” | 没有复现和验证 |
| “后续再做” | 没有用户同意延期 |
| “已完成”但还有 Next Action | 实际是 Partial |
