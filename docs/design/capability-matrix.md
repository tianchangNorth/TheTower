# TheTower 能力矩阵

> 最后核验：2026-07-22。状态以代码、自动化测试和发布说明三者同时满足为准。

| 能力 | 实现 | 自动化验证 | 当前发布口径 | 备注 |
| --- | --- | --- | --- | --- |
| 用户消息创建 Invocation | 是 | API `app.inject` | 支持 | `POST /api/messages` 返回 202 |
| `single` / `serial` 路由 | 是 | 单元 + API 集成 | 支持 | 当前 worklist 为串行执行 |
| `fanout` / `parallel` | 否 | API 422 集成测试 | 不支持 | 历史数据可读，新请求拒绝 |
| Mock / Codex / Claude provider | 是 | Runner 单元 + opt-in 真实 isolation harness | 支持 | 2026-07-22 Codex/Claude 真实报告均通过；后续重跑仍依赖本地 CLI、登录状态与操作者的数据披露批准 |
| Gemini / OpenAI API / Custom provider | 否 | API 422 集成测试 | 不支持 | 不再静默降级 Mock |
| Agent callback 写入 | 是 | API 允许/拒绝/跨 Agent 拒绝集成测试 | 支持 | Bearer grant 绑定当前 Agent；持久化 Step 审计待 Phase 2 |
| 稳定错误响应 | 是 | shared contract + API/SDK/MCP 单元与集成测试 | 支持 | `{ error, code, details? }`；客户端逻辑依赖 `code`，不依赖文案 |
| Invocation 取消 | 部分 | API 集成 + Playwright Stop 主链 | 支持（进程内） | Codex 使用 TERM→5 秒→KILL；重启恢复待 Phase 2 |
| 默认 MCP 工具权限 | 是 | MCP 单元测试 | 仅协作工具 | 默认不提供文件写入或 shell；危险 profile 必须显式设置 |
| API 控制面 | 是 | API/App 单元测试 | loopback | 非 loopback 必须配置 Operator Token |
| Thread 删除 | 是 | API 集成测试 | 支持 | 数据库级联由 Store 测试覆盖 |
| SSE 实时事件与 replay | 是 | EventBus/API/Web 单元测试 | 支持 | SQLite event log、`id:`、Last-Event-ID replay、sync 与 heartbeat；事务 outbox 待 Phase 2 |
| UI 事件刷新 | 是 | Web 单元测试 | 支持 | runtime 本地投影；消息/Invocation/worklist 100ms 合并补拉 |
| Message 投影去重 | 是 | Web 单元测试 | 支持 | visibility、visibleTo、handoff、replyTo 纳入身份 |
| 浏览器端 E2E | 是 | Playwright production 主链 | 发布门禁 | CI 验证 hydration、API/health、Thread 创建、发送、private reveal、Stop、稳定失败与 SSE 重连 |
| A2A 输出隔离 | 是 | unit/integration + Codex/Claude 真实 harness | 支持 | stdout 仅 `agent_stream`、显式 callback、play/debug/thinking 规则均通过自动化及 2026-07-22 真实 Provider 验收 |
| Stream 存储预算 | 是 | 300 chunk 单行回归 + DB observer | 支持 | 每 invocation+agent 一行；默认 payload 告警阈值 1 MiB |

## 验证命令

```bash
pnpm test:unit
pnpm test:integration
pnpm test:migration  # 独立历史数据库 fixture 升级与幂等验证
pnpm test:e2e        # production API/Web + Chromium 主用户链
pnpm test:ci
```
