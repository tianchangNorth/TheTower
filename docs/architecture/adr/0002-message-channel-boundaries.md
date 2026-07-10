# ADR-0002：冻结消息通道与回调边界

- 状态：已采纳
- 日期：2026-07-10
- 决策范围：用户消息、Agent callback、SSE

## 背景

TheTower 有三类不同语义的消息通道：用户发起执行、Agent 回调正式消息、服务器向 UI 推送事件。把它们混为一个“消息”接口会造成身份、路由和可见性语义漂移。

## 决策

1. `POST /api/messages` 仅用于创建用户消息与 Invocation；其 `routeMode` 只可为 `single` 或 `serial`。
2. `POST /api/callbacks/post-message` 只追加当前 Invocation 的正式 Agent callback。callback 不得重设 route mode；携带该字段时返回 `422 route_mode_not_applicable`。
3. callback token 校验失败保持拒绝响应，且不会创建消息。后续 Phase 1 将 token 收紧为 step 与 agent 绑定的 capability grant。
4. SSE 每个事件必须是完整的 `data: <json>\n\n` 帧；当前为实时流，不宣称支持 replay 或断线补偿。

## 后果

- SDK 的用户请求 DTO 仅暴露受支持的路由模式；保留 Invocation 中完整模式类型以读取历史数据。
- callback 的路由由 Invocation/worklist 决定，调用方不能用请求字段伪造调度语义。
- 新增通道能力时必须同时定义认证、持久化、幂等、可见性和 SSE 投影。

