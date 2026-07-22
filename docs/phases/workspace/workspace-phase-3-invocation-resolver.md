# Workspace Phase 3：Invocation WorkspaceResolver

> 文档状态：Superseded（历史 Phase 记录）
> 当前来源：[当前项目架构](../../architecture/current-project-architecture.md)、[能力矩阵](../../design/capability-matrix.md)
> 本文不再表示当前安全默认值、实现状态或开发顺序。

## 目标

在启动 Agent invocation 前，统一从 thread `projectPath` 解析出运行时 `workingDirectory` 和 `workspaceFingerprint`，并按 provider 策略决定是否允许运行。

## 核心原则

1. Runner 不访问 ThreadStore。
2. Runner 不自己猜 cwd。
3. `CommunicationService` / invocation 层负责解析 workspace。
4. 真实 coding provider 缺合法 workspace 时 fail closed。
5. `mock` provider 不需要 workspace，继续运行。

## Provider Policy

新增：

```text
packages/api/src/agents/ProviderWorkspacePolicy.ts
```

```ts
export interface ProviderWorkspacePolicy {
  requiresThreadWorkspace: boolean;
  usesSpawnCwd: boolean;
  usesCliWorkspaceArg: boolean;
  injectsMcpAllowedDirs: boolean;
  separatesSpawnCwdFromWorkspace: boolean;
}
```

初始策略：

| Provider | requiresThreadWorkspace | 说明 |
| --- | --- | --- |
| `mock` | false | 不需要 cwd |
| `codex` | true | 必须绑定 workspace |
| `claude` | true | 必须绑定 workspace |
| `gemini` | true | 后续接入时必须绑定 workspace |
| `openai-api` | false | API-only，可不需要本地 cwd |
| `custom` | true | 默认 fail closed |

## WorkspaceResolver

新增：

```text
packages/api/src/workspaces/WorkspaceResolver.ts
```

输出：

```ts
export interface ResolvedThreadWorkspace {
  projectPath?: string;
  workingDirectory?: string;
  workspaceFingerprint?: string;
}
```

规则：

1. thread 有 `projectPath`：调用 `validateProjectPathDetailed`。
2. validate 失败：真实 coding provider fail closed。
3. thread 无 `projectPath`：按 provider policy 判断。
4. `workspaceFingerprint` 用规范化真实路径计算。

## AgentRunInput

扩展：

```ts
export interface AgentRunInput {
  projectPath?: string;
  workingDirectory?: string;
  workspaceFingerprint?: string;
}
```

## 错误文案

真实 provider 缺 workspace 时返回可操作错误：

```text
Codex requires a project workspace for this thread. Bind the thread to an existing directory under /Users/xuchenyang before running Codex.
```

## 主要文件

- `packages/shared/src/index.ts`
- `packages/api/src/agents/ProviderWorkspacePolicy.ts`
- `packages/api/src/workspaces/WorkspaceResolver.ts`
- `packages/api/src/services/CommunicationService.ts`
- `packages/api/src/stores/InvocationStore.ts`

## 开发任务

1. 实现 provider workspace policy。
2. 实现 `WorkspaceResolver`。
3. `CommunicationService.startInvocation` 注入 workspace fields。
4. coding provider 缺 workspace 时 fail closed。
5. 发布 workspace resolved / failed 事件，便于 UI 和审计。

## 验收标准

- `mock` thread 无 `projectPath` 仍可运行。
- `codex` thread 无 `projectPath` 拒绝运行。
- thread 有合法 `projectPath` 时，`AgentRunInput.workingDirectory` 为规范化路径。
- validation 失败不会启动真实 CLI。
- `workspaceFingerprint` 稳定生成。

## 测试建议

```bash
cd packages/api
node --import tsx --test test/CommunicationService.test.ts
```

## 不做事项

- 不改 provider 具体 cwd 参数；Phase 4 处理。
- 不做 session resume guard；Phase 5 处理。
