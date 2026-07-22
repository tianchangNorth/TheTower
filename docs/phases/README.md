# TheTower 分阶段开发索引

> 文档状态：Superseded（历史实施索引）
> 替代来源：[技术 Roadmap](../ROADMAP.md)、[能力矩阵](../design/capability-matrix.md)、[当前项目架构](../architecture/current-project-architecture.md)
> 保留目的：记录早期 collaboration/workspace/frontend/runtime-status 的拆分过程，不再表示推荐开发顺序或当前完成度。

来源总方案：[协作上下文与 Skills 升级方案](../design/collaboration-context-and-skills-upgrade-plan.md)（同为历史设计记录）。

## 阶段顺序

历史开发顺序：

```text
Phase 1 Skills 基础设施
→ Phase 2 Message 可见性模型
→ Phase 3 ContextBuilder 统一上下文入口
→ Phase 4 Callback / MCP 可见性升级
→ Phase 5 A2A 协作治理与 UI 完成态
→ Phase 6 A2A 通道语义与去重重构
```

历史说明（不得作为当前 Roadmap）：

- Phase 1 已经基本完成，后续只做补强。
- Phase 2 和 Phase 3 可以交叉推进，但必须保证所有 Agent 上下文最终都走 `ContextBuilder`。
- Phase 4 不应早于 Phase 2 / Phase 3 完成，否则 private callback 容易绕过可见性模型。
- Phase 5 主要做交互体验、协作治理和端到端验收。
- Phase 6 是参考 Cat Cafe 后的架构校正，重点修正 callback / final / stream 通道语义，并把 A2A 重复触发放到调度层处理。

## 阶段文档

1. [Phase 1：Skills 基础设施](./collaboration/phase-1-skills-infrastructure.md)
2. [Phase 2：Message 可见性模型](./collaboration/phase-2-message-visibility.md)
3. [Phase 3：ContextBuilder 统一上下文入口](./collaboration/phase-3-context-builder.md)
4. [Phase 4：Callback 与 MCP 可见性升级](./collaboration/phase-4-callback-mcp-visibility.md)
5. [Phase 5：A2A 协作治理与 UI 完成态](./collaboration/phase-5-a2a-governance-ui.md)
6. [Phase 6：A2A 通道语义与去重重构](./collaboration/phase-6-a2a-channel-semantics.md)

## Workspace 生产级阶段

来源总方案：[对话级工作目录生产级方案](../design/agent-working-directory-selection-plan.md)

1. [Workspace Phase 1：路径安全与 Workspace 底座](./workspace/workspace-phase-1-security-foundation.md)
2. [Workspace Phase 2：Thread projectPath 绑定](./workspace/workspace-phase-2-thread-binding.md)
3. [Workspace Phase 3：Invocation WorkspaceResolver](./workspace/workspace-phase-3-invocation-resolver.md)
4. [Workspace Phase 4：Codex / Claude Provider 对齐](./workspace/workspace-phase-4-provider-alignment.md)
5. [Workspace Phase 5：Session Workspace Guard](./workspace/workspace-phase-5-session-guard.md)
6. [Workspace Phase 6：前端 Workspace 体验](./workspace/workspace-phase-6-frontend-experience.md)
7. [Workspace Phase 7：平台托管 MCP 文件工具](./workspace/workspace-phase-7-managed-mcp-tools.md)

## Agent Runtime Status 阶段

来源总方案：[Agent 状态栏设计方案](../design/agent-status-bar-design.md)

1. [Agent Runtime Status：一步到位阶段方案](./agent-status/agent-status-runtime-phases.md)
2. [Provider Token Usage 设计方案](../design/provider-token-usage-design.md)

## Frontend 产品化阶段

来源总方案：[TheTower 前端开发总控文档](../frontend/frontend-development-plan.md)

1. [Frontend Phase 1：Next Shell 与设计系统底座](./frontend/frontend-phase-1-next-shell-design-system.md)
2. [Frontend Phase 2：Command 首页工作台](./frontend/frontend-phase-2-command-workbench.md)
3. [Frontend Phase 3：Agent 配置治理](./frontend/frontend-phase-3-agent-configuration.md)
4. [Frontend Phase 4：Telemetry 与 Thread Context](./frontend/frontend-phase-4-telemetry-context.md)
5. [Frontend Phase 5：Workspace 与工具活动](./frontend/frontend-phase-5-workspace-tool-activity.md)
6. [Frontend Phase 6：Tasks / Mission 与 Settings 收口](./frontend/frontend-phase-6-tasks-settings.md)

## 总体完成标准

升级完成后，TheTower 应满足：

- 用户看到的是正确展示给用户的 `Message.content`。
- 目标 Agent 能收到完整结构化 `handoffPayload`。
- 所有 Agent 上下文统一由 `ContextBuilder` 构造。
- `VisibilityPolicy` 是可见性判断的单一入口。
- CLI 实时事件不默认成为 thread 协作事实。
- callback / MCP 默认公开写回，private 写回只在 Phase 4 后受控开放。
- UI 能区分 public / private / callback / stream / briefing / tool。
- 用户始终拥有全量审计能力。
- callback、agent final、agent stream 的语义清晰分离；重复显示由 exact duplicate gate 处理，重复调度由 Worklist / Dispatch 层处理。
- 文件读写类 MCP 工具由 TheTower API 托管，权限边界来自 thread workspace，而不是各 CLI provider 自己的权限弹窗。
