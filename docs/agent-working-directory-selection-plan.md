# 对话级工作目录生产级方案

生成时间：2026-06-29

参考项目：

- `/Users/xuchenyang/ai/clowder-ai`
- `/Users/xuchenyang/ai/cat-cafe-tutorials`

## 目标结论

TheTower 的工作目录功能按猫咖的生产模型设计：

```text
Workspace / Project
  -> Thread 绑定 projectPath
  -> Invocation 解析并校验 workingDirectory
  -> Provider 按自身语义使用 cwd / 授权目录 / session workspace binding
  -> 同一 Thread 内所有 Agent 共享同一工作目录
```

核心决策：

1. 工作目录属于项目 / 对话，不属于单个 Agent。
2. Thread 持久化 `projectPath`，invocation 使用校验后的 `workingDirectory`。
3. 真实 coding provider 缺少合法 workspace 时 fail closed；`mock` provider 继续运行。
4. 默认 allowed root 为 `/Users/xuchenyang`。
5. 第一版前端先用文本输入，后端严格 validate。
6. Workspace 初期用目录 `basename` 作为 name，后续支持用户重命名。
7. Session resume 必须校验 `workspaceFingerprint`，防止跨项目串台。
8. MCP / 文件工具 / sandbox 授权目录必须跟 thread workspace 对齐。

## 分阶段文档

按 `docs/phases` 方式拆分为以下开发步骤：

1. [Workspace Phase 1：路径安全与 Workspace 底座](./phases/workspace-phase-1-security-foundation.md)
2. [Workspace Phase 2：Thread projectPath 绑定](./phases/workspace-phase-2-thread-binding.md)
3. [Workspace Phase 3：Invocation WorkspaceResolver](./phases/workspace-phase-3-invocation-resolver.md)
4. [Workspace Phase 4：Codex / Claude Provider 对齐](./phases/workspace-phase-4-provider-alignment.md)
5. [Workspace Phase 5：Session Workspace Guard](./phases/workspace-phase-5-session-guard.md)
6. [Workspace Phase 6：前端 Workspace 体验](./phases/workspace-phase-6-frontend-experience.md)

## 与猫咖的对应关系

| 猫咖能力 | TheTower 生产级对应 |
| --- | --- |
| `thread.projectPath` | `Thread.projectPath` |
| `validateProjectPathDetailed` | `workspaces/projectPath.ts` |
| invocation `workingDirectory` option | `AgentRunInput.workingDirectory` |
| `workspaceFingerprint` | `AgentRunInput.workspaceFingerprint` + session record |
| `providerRequiresThreadWorkspace` | `ProviderWorkspacePolicy.requiresThreadWorkspace` |
| Codex MCP `ALLOWED_WORKSPACE_DIRS` | TheTower MCP per-invocation env |
| spawn cwd / active workspace 解耦 | 后续 provider policy |
| project/workspace routes | Workspace API |
| workspace guard drop stale session | Session Workspace Guard |

## 总体完成标准

完成后，TheTower 应满足：

- 用户新建对话时选择一个 workspace，该 thread 内所有 Agent 都在该 workspace 中协作。
- 真实 coding provider 在没有合法 workspace 时拒绝运行，并给出可操作错误。
- `mock` provider 不受 workspace 约束，便于调试。
- `projectPath` 必须存在、是目录、位于 `/Users/xuchenyang` 或显式 allowed roots 内。
- Codex / Claude runner 都从 `AgentRunInput.workingDirectory` 获取 cwd。
- Codex MCP / 文件工具的 allowed dirs 与 thread workspace 一致。
- CLI session resume 时校验 `workspaceFingerprint`，不允许旧 session 跨项目复用。
- 前端始终清楚展示当前 thread 的 workspace label 和 path。
