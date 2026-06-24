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

## 包结构

```text
packages/
  shared/  共享类型：Agent、Thread、Message、Invocation、API request/response
  api/     后端服务：Fastify、SQLite、Agent 调度、Callback API、SSE
  sdk/     调用客户端：平台 API Client 和 Agent Callback Client
```

`api` 和 `sdk` 都依赖 `shared`，后续新增 `web` 包时也直接复用 `shared`，避免前后端重复定义协议类型。

## 本地启动

```bash
pnpm install
pnpm --filter @the-tower/api dev
```

默认 API 地址：

```text
http://127.0.0.1:3001
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

## 当前边界

- `codex` provider 目前仍映射到 `MockRunner`，下一步再接真实 `CodexCliRunner`。
- Worklist 和 running invocation 当前在单进程内存中，第一阶段暂不引入 Redis。
- 目前没有前端 UI，先通过 API 验证通信内核。
- `sqlite-vec` 暂未使用，等长期记忆和语义检索阶段再引入。
