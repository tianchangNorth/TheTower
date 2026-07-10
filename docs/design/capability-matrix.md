# TheTower 能力矩阵

> 最后核验：2026-07-10。状态以代码、自动化测试和发布说明三者同时满足为准。

| 能力 | 实现 | 自动化验证 | 当前发布口径 | 备注 |
| --- | --- | --- | --- | --- |
| 用户消息创建 Invocation | 是 | API `app.inject` | 支持 | `POST /api/messages` 返回 202 |
| `single` / `serial` 路由 | 是 | 单元 + API 集成 | 支持 | 当前 worklist 为串行执行 |
| `fanout` / `parallel` | 否 | API 422 集成测试 | 不支持 | 历史数据可读，新请求拒绝 |
| Mock / Codex / Claude provider | 是 | Runner 单元测试 | 支持 | 依赖本地 CLI/运行环境 |
| Gemini / OpenAI API / Custom provider | 否 | API 422 集成测试 | 不支持 | 不再静默降级 Mock |
| Agent callback 写入 | 是 | API 允许/拒绝/跨 Agent 拒绝集成测试 | 支持 | Bearer grant 绑定当前 Agent；持久化 Step 审计待 Phase 2 |
| Invocation 取消 | 部分 | API 集成测试 | 支持（进程内） | Codex 使用 TERM→5 秒→KILL；重启恢复待 Phase 2 |
| 默认 MCP 工具权限 | 是 | MCP 单元测试 | 仅协作工具 | 默认不提供文件写入或 shell；危险 profile 必须显式设置 |
| API 控制面 | 是 | API/App 单元测试 | loopback | 非 loopback 必须配置 Operator Token |
| Thread 删除 | 是 | API 集成测试 | 支持 | 数据库级联由 Store 测试覆盖 |
| SSE 实时事件格式 | 是 | 单元测试 | 支持（仅实时） | 无 replay/catch-up |
| 浏览器端 E2E | 否 | 无 | 不支持 | Phase 3 配置 Playwright 后再纳入 CI |

## 验证命令

```bash
pnpm test:unit
pnpm test:integration
pnpm test:e2e        # 当前运行 API 端到端路由 smoke；浏览器 E2E 尚未配置
pnpm test:ci
```
