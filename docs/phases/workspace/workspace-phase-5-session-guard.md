# Workspace Phase 5：Session Workspace Guard

> 文档状态：Superseded（历史 Phase 记录）
> 当前来源：[当前项目架构](../../architecture/current-project-architecture.md)、[能力矩阵](../../design/capability-matrix.md)
> 本文不再表示当前安全默认值、实现状态或开发顺序。

## 目标

防止 CLI session resume 到错误项目。任何可复用 session 都必须绑定 `workspaceFingerprint`，resume 前严格校验。

## 背景

猫咖经验表明，CLI provider 的 session / cache / history 如果跨 workspace 复用，会导致：

- Agent 以为自己还在旧 repo。
- 工具历史与当前项目不一致。
- review / 修改落到错误工作树。
- 多 worktree 并行时上下文串台。

## 数据模型

新增或扩展 session record：

```ts
export interface AgentSessionRecord {
  provider: AgentProvider;
  agentId: string;
  threadId: string;
  cliSessionId: string;
  workingDirectory?: string;
  workspaceFingerprint?: string;
  createdAt: number;
  updatedAt: number;
}
```

`workspaceFingerprint` 由规范化 `workingDirectory` 计算。

## Resume Guard

规则：

```text
if stored.workspaceFingerprint !== current.workspaceFingerprint:
  do not resume old session
  mark old session stale or delete it
  start fresh
  write audit/system event
```

事件：

```ts
{
  type: "workspace.session_guard";
  action: "start_fresh";
  reason: "workspace_mismatch" | "workspace_unknown";
  threadId: string;
  agentId: string;
  storedWorkingDirectory?: string;
  currentWorkingDirectory?: string;
}
```

## 主要文件

- `packages/shared/src/index.ts`
- `packages/api/src/stores/AgentSessionStore.ts`
- `packages/api/src/services/CommunicationService.ts`
- `packages/api/src/events/EventBus.ts`

## 开发任务

1. 新增 session store 或扩展现有 session 记录。
2. 每次成功启动 / 获取 CLI session 时写入 workspace binding。
3. resume 前校验 fingerprint。
4. mismatch 时 fresh start。
5. 写入 audit / system event。
6. 增加测试覆盖 workspace mismatch。

## 验收标准

- 同一 thread、同一 workspace 可以 resume。
- 修改 thread `projectPath` 后旧 session 不再 resume。
- 缺少 stored fingerprint 的旧 session 不再 resume，并 fresh start。
- mismatch 事件可审计。

## 测试建议

```bash
cd packages/api
node --import tsx --test test/AgentSessionStore.test.ts test/CommunicationService.test.ts
```

## 不做事项

- 不实现 provider 自己的复杂 cache sandbox；后续接 Gemini / Antigravity 时单独做。
