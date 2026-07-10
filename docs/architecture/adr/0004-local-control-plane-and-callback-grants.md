# ADR-0004：本地控制面与 callback grant

- 状态：已采纳
- 日期：2026-07-10
- 决策范围：API 绑定、CORS、Agent callback、MCP 文件工具

## 决策

1. API 默认只允许 loopback 绑定。若 `HOST` 不是 loopback，必须设置 `THE_TOWER_OPERATOR_TOKEN`；否则进程拒绝启动。
2. CORS 默认仅允许本地 Web 开发源；扩展来源必须通过 `THE_TOWER_ALLOWED_ORIGINS` 显式配置。
3. callback token 仅通过 `Authorization: Bearer <token>` 传递，禁止放入 URL 或 request body。读取上下文改为认证 `POST /api/callbacks/thread-context`。
4. 每个当前执行 Agent 获得独立、会轮换的 callback grant；grant 绑定 invocation、Agent、内部 step id、过期时间和活跃状态。终态会立即失效。
5. callback 与文件工具先校验 invocation 状态、Bearer token 和 Agent 绑定，之后才写消息或访问 Workspace。

## 后果

- 旧的 callback GET URL 和 body token 不兼容；SDK、MCP client 和 CLI 提示已同步迁移。
- Phase 2 将把当前内部 step id 提升为持久化 `invocation_steps`，并增加 grant 审计记录。

