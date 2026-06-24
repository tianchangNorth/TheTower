# TheTower 多 Agent 平台

这是按 `multi-agent-communication-architecture.md` 开始实现的第一阶段 MVP，当前目标是先跑通多 Agent 通信内核，而不是一次性实现完整产品。

## 当前已实现

- `pnpm` monorepo 基础结构
- `@the-tower/shared` 共享领域类型与 API 协议类型
- Fastify API 服务
- `@the-tower/sdk` HTTP Client 与 Agent Callback Client
- SQLite + `better-sqlite3` 本地持久化
- `agents`、`threads`、`messages`、`invocations`、`callback_tokens` 表结构
- Agent 注册表与默认 Mock Agent
- Mention 解析：通过 `@agent-a`、`@agent-b` 等 handle 路由
- Worklist 接力：同一次 invocation 内支持 A → B → C
- A2A 防护：pending 去重、深度限制、调用者校验、ping-pong 阻断
- Callback API：Agent 可向 thread 写消息并触发其他 Agent
- SSE 事件流：推送 message 和 invocation 状态变化
- `CodexCliRunner`：当 Agent provider 为 `codex` 时调用本机 `codex exec`

## 包结构

```text
packages/
  shared/  共享类型：Agent、Thread、Message、Invocation、API request/response
  api/     后端服务：Fastify、SQLite、Agent 调度、Callback API、SSE
  sdk/     调用客户端：平台 API Client 和 Agent Callback Client
  web/     调试前端：Agent 配置、thread 消息、SSE 事件、消息发送
```

`api`、`sdk`、`web` 都依赖 `shared`，避免前后端重复定义协议类型。

## 本地启动

```bash
pnpm install
pnpm dev
```

单独启动：

```bash
pnpm dev:api
pnpm dev:web
```

默认 API 地址：

```text
http://127.0.0.1:3001
```

默认 Web 地址：

```text
http://127.0.0.1:5173
```

默认 SQLite 文件：

```text
packages/api/data/app.db
```

也可以通过环境变量指定：

```bash
APP_DB=/tmp/the-tower.db pnpm --filter @the-tower/api dev
```

## 常用接口

健康检查：

```bash
curl http://127.0.0.1:3001/health
```

查看 Agent：

```bash
curl http://127.0.0.1:3001/api/agents
```

把 Agent 切换为 Codex CLI：

```bash
curl -X PATCH http://127.0.0.1:3001/api/agents/agent-a \
  -H 'content-type: application/json' \
  -d '{"provider":"codex","model":"gpt-5"}'
```

发送用户消息并触发 Agent：

```bash
curl -X POST http://127.0.0.1:3001/api/messages \
  -H 'content-type: application/json' \
  -d '{"content":"@agent-a 设计一个通信方案，然后请 @agent-b review"}'
```

查看 thread 消息：

```bash
curl http://127.0.0.1:3001/api/threads/{threadId}/messages
```

订阅事件流：

```bash
curl -N http://127.0.0.1:3001/api/events
```

## 测试

```bash
pnpm lint
pnpm test
pnpm build
```

也可以只验证单个包：

```bash
pnpm --filter @the-tower/api test
pnpm --filter @the-tower/sdk test
```

## SDK 示例

平台侧发送用户消息：

```ts
import { TheTowerClient } from "@the-tower/sdk";

const client = new TheTowerClient({ baseUrl: "http://127.0.0.1:3001" });

const result = await client.postUserMessage({
  content: "@agent-a 设计方案，然后请 @agent-b review",
});
```

Agent 侧 callback 写回消息：

```ts
import { AgentCallbackClient } from "@the-tower/sdk";

const callback = new AgentCallbackClient({
  baseUrl: "http://127.0.0.1:3001",
  invocationId: process.env.INVOCATION_ID!,
  callbackToken: process.env.CALLBACK_TOKEN!,
  agentId: process.env.AGENT_ID!,
});

await callback.postMessage({
  content: "@agent-b 请继续 review 数据库设计",
});
```

## Codex Runner

当 Agent 的 `provider` 是 `codex` 时，API 会通过 `CodexCliRunner` 调用本机 `codex exec`。

默认行为：

```text
codex --ask-for-approval never exec --sandbox read-only --cd <cwd> --output-last-message <tmp-file> --color never --model <agent.model> -
```

可用环境变量：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `CODEX_CLI_BIN` | `codex` | Codex CLI 命令路径 |
| `CODEX_RUNNER_CWD` | 当前 API 进程目录 | Codex 执行工作目录 |
| `CODEX_RUNNER_SANDBOX` | `read-only` | Codex 沙箱：`read-only`、`workspace-write`、`danger-full-access` |
| `CODEX_RUNNER_APPROVAL` | `never` | Codex approval policy：`untrusted`、`on-request`、`never` |
| `CODEX_RUNNER_TIMEOUT_MS` | `300000` | 单次 Codex 调用超时时间 |
| `DEFAULT_AGENT_PROVIDER` | `mock` | 空数据库首次 seed 默认 Agent 时使用；可设为 `codex` |
| `CODEX_AGENT_MODEL` | `gpt-5` | `DEFAULT_AGENT_PROVIDER=codex` 时的默认模型 |

为了避免开发时意外触发真实模型调用，默认 seed 的 Agent 仍然是 `mock`。可以通过上面的 `PATCH /api/agents/{agentId}` 接口切换单个 Agent。

## 当前边界

- `CodexCliRunner` 当前读取 `codex exec` 的最终消息写回 thread，暂未解析 JSONL 事件做 token 级流式输出。
- Worklist 和 running invocation 当前在单进程内存中，第一阶段暂不引入 Redis。
- 目前没有前端 UI，先通过 API 验证通信内核。
- `sqlite-vec` 暂未使用，等长期记忆和语义检索阶段再引入。
