# ADR-0005：可重放事件流与 UI 投影

- 状态：已采纳
- 日期：2026-07-10
- 决策范围：事件日志、SSE、前端刷新与消息投影

## 决策

1. 所有 `EventBus.publish` 先追加到 SQLite `event_log`，再广播；日志保留最近 20,000 条。
2. SSE 为每个事件发送单调 `id:`；客户端重连时使用浏览器 `Last-Event-ID` 自动请求缺失事件。服务端 replay 后发送 `event: sync`。
3. SSE 连接每 15 秒发送 heartbeat；客户端状态统一为 `connecting`、`catching-up`、`synced`、`reconnecting`、`stale`。
4. Agent runtime 事件只更新本地 runtime 投影。消息、Invocation、worklist 事件才触发 Thread 快照补拉，且以 100ms 合并。
5. Message 去重键必须包含 visibility、visible-to、handoff payload、reply-to，不能只按正文合并。

## 后果

- API 重启后可从 SQLite replay 已提交的事件；事务 outbox 与严格顺序保证仍归属 Phase 2。
- SSE 客户端可区分“已同步”和“已连接但尚未确认同步”。
- UI 对真实事件 payload 的 reducer 可在后续逐步补充，当前保留权威 REST snapshot 作为最终校正来源。

