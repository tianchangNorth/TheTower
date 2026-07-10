# ADR-0001：冻结 Invocation 的状态语义

- 状态：已采纳
- 日期：2026-07-10
- 决策范围：`Invocation`、Runner outcome、取消与测试断言

## 背景

运行状态是 UI、Telemetry、Task 和审计的共同事实来源。测试曾把 Thread 默认模式和迁移后的模式当作 `debug`，但数据库契约已是 `play`；Claude CLI 的失败 mock 也因 stdout 未关闭而让测试永久等待。这类不一致会让“通过测试”不再代表运行时语义正确。

## 决策

1. 新建 Thread 和旧 Thread 迁移后的默认 `mode` 固定为 `play`。
2. `agent_stream` 在 `play` 模式对所有 Agent 上下文隐藏；测试构造公开消息时必须显式采用 `callback`、`user` 或其他可见 origin。
3. Runner mock 必须关闭 stdout/stderr 后再发出 `close`；测试不得依赖未结束的可读流。
4. Invocation 的终态仅为 `done`、`failed`、`cancelled`。后续 Phase 1 引入 `cancelling` 与 `interrupted` 时必须同时迁移 API、持久化、UI 和测试。

## 后果

- `play` 成为唯一默认交互模式，debug 只可显式选择。
- 测试需要表达可见性来源，不能以隐式默认值掩盖策略。
- 流关闭成为 Runner contract 的一部分；CI 将不再因测试 mock 悬挂。

