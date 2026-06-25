---
name: receive-review
description: >
  处理 reviewer 反馈：分类、验证、修复或 push back。
  Use when: 收到 review 意见、changes requested、fix these。
  Not for: 发起 review 请求。
  Output: 逐项反馈处理结果。
triggers:
  - "review 结果"
  - "review 意见"
  - "changes requested"
  - "fix these"
---

# Receive Review

处理 review 的核心原则：技术正确性优先。不要表演性同意，也不要未经验证就修改。

## 反馈类型

| 类型 | 处理 |
| --- | --- |
| Bug / 行为错误 | 复现，补测试或最小验证，再修 |
| 风险 / 边界遗漏 | 验证是否真实存在，成立则补防护 |
| 架构建议 | 对照当前约束和目标，接受或 push back |
| 风格偏好 | 判断是否符合项目惯例，不盲从 |
| 需求偏差 | 回到用户原始请求，必要时问用户 |

## 流程

1. READ：完整读完反馈。
2. CLASSIFY：区分 bug、风险、风格建议、需求偏差。
3. VERIFY：确认问题是否真实存在。
4. FIX 或 PUSH BACK：
   - 问题成立：修复，并补验证。
   - 问题不成立：用事实和证据说明原因。
5. CONFIRM：逐项说明处理结果。

## Verify 三道门

1. Spec Gate：review 意见是否与用户原始请求冲突？
2. Mechanism Gate：reviewer 指出的问题有没有具体失败路径？
3. Regression Gate：按建议修改后，核心路径是否仍然成立？

三道门没有过，不要机械照改。

## Push Back 标准

必须 push back 的情况：

- 建议会破坏现有需求。
- reviewer 缺少关键上下文。
- 建议引入明显过度设计。
- 建议与用户明确选择冲突。
- 本地验证证明问题不存在。

Push back 要用证据，不用情绪。

## 禁止

- 不要回复“你说得完全正确”然后直接改。
- 不要只修 reviewer 点名的一处，而忽略同类问题。
- 不要在没有验证证据时声称“已修复”。
- 不要把所有 review 意见都当命令；review 是技术讨论，不是单向服从。

## 输出模板

```md
### Review Feedback Handling

- Item: ...
  Verdict: confirmed / not reproduced / push back
  Action: ...
  Evidence: ...
```

## 同类问题扫描

如果同一类问题出现两次以上，做一次 sweep：

- 抽象出违反的不变量。
- 搜索同类调用点或同类边界。
- 一次性修掉同类问题。
- 在回复里说明 sweep 范围。

## 完成标准

- 每条 feedback 都有处理结果。
- 成立的问题有验证证据。
- push back 的问题有清晰理由。
- 如修改了实现，回到 `quality-gate`。
