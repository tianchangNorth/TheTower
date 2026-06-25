---
name: request-review
description: >
  向其他 Agent 发送 review 请求，必须包含交接五件套和验证证据。
  Use when: 自检通过后准备请其他 Agent review。
  Not for: 收到 review 反馈。
  Output: Review 请求消息。
triggers:
  - "请 review"
  - "帮我看看"
  - "request review"
---

# Request Review

Review 请求的目标是让 reviewer 把时间花在关键风险上，而不是重新猜你的背景。

## 何时使用

使用：

- 你完成了实现、设计或调研，需要另一个 Agent 审查。
- 用户明确要求 review。
- 当前任务风险较高，需要第二视角。

不要使用：

- 你还没完成基本自检。
- 你只是想让别人接着做，不是审查；这时用 `cross-agent-handoff`。
- review 意见已经返回；这时用 `receive-review`。

## 前置条件

- 已完成 Quality Gate。
- 已说明测试、lint、构建或手动验证情况。
- 已明确改动范围和 review 重点。
- 如果有未决问题，要写在 Open Questions 里。

## Reviewer 选择

优先选择：

- 没参与这段实现的 Agent。
- 角色更适合审查的人，例如架构、质量、测试、边界。
- 能从不同角度挑战方案的人。

避免：

- 自己 review 自己。
- 找没有上下文且不给背景的 Agent。
- 只为了流程而 review。

## Review 请求必须包含

- What：改了什么，涉及哪些模块或文件。
- Why：为什么要这样改。
- Tradeoff：考虑过哪些替代方案。
- Open Questions：希望 reviewer 判断的技术或产品问题。
- Next Action：请 reviewer 具体关注什么。
- Evidence：你已经做过哪些验证，哪些没做。

## 路由要求

使用行首 mention 发给 reviewer：

```md
@<reviewer-agent> 请 review：

### What
...

### Why
...

### Tradeoff
...

### Open Questions
...

### Evidence
...

### Next Action
...
```

不要发“帮我看看”这种无上下文请求。

## Block 场景

### 没有自检证据

```md
@ikora 我改好了，帮我 review。
```

应阻止。Reviewer 不应该是第一个发现测试没跑、范围不清的人。

### Review 重点不明确

```md
@banshee 看看有没有问题。
```

应阻止。需要明确重点：架构边界、数据模型、错误处理、测试覆盖、UI 体验等。

## Review 请求模板

```md
@<reviewer> 请 review：

### What
...

### Why
...

### Tradeoff
...

### Open Questions
- 技术问题：...
- 需要用户判断的问题：...

### Evidence
- 已运行：...
- 未运行：...（原因）

### Next Action
请重点检查 ...
```
