<!-- GENERATED FILE: run `pnpm docs:generate`; source: docs/metadata.json -->
# TheTower 文档索引

本文由 `docs/metadata.json` 自动生成，请勿手工维护分类或状态。修改 metadata 后运行 `pnpm docs:generate`，提交前运行 `pnpm docs:check`。

## 真相源规则

- 当前是否支持某能力：能力矩阵；
- 当前系统如何工作：Current 架构与页面说明；
- 后续做什么：技术/产品 Roadmap；
- 为什么这样设计：Accepted ADR；
- 如何验收：Runbook 与 Completed record；
- `Superseded` 与 `Reference` 文档不得作为当前发布承诺。

## 当前真相源

这些文档描述当前能力、实现、路线与操作方法。

- [TheTower 当前 A2A 架构](./architecture/current-a2a-architecture.md) — 架构，核验 2026-07-22
- [TheTower 当前项目架构](./architecture/current-project-architecture.md) — 架构，核验 2026-07-22
- [TheTower 能力矩阵](./design/capability-matrix.md) — 能力口径，核验 2026-07-22
- [TheTower 前端页面功能说明](./frontend/frontend-pages-guide.md) — 前端，核验 2026-07-22
- [TheTower 产品成熟度路线图](./PRODUCT_MATURITY_ROADMAP.md) — Roadmap，核验 2026-07-22
- [TheTower Roadmap](./ROADMAP.md) — Roadmap，核验 2026-07-22
- [R0.8 A2A isolation 验收手册](./runbooks/r0.8-a2a-isolation-acceptance.md) — 运行手册，核验 2026-07-22

## 已采纳 ADR

架构决策记录解释关键约束及其原因。

- [ADR-0001：冻结 Invocation 的状态语义](./architecture/adr/0001-invocation-state-semantics.md) — 架构决策
- [ADR-0002：冻结消息通道与回调边界](./architecture/adr/0002-message-channel-boundaries.md) — 架构决策
- [ADR-0003：以能力门禁替代静默降级](./architecture/adr/0003-provider-and-route-capability-gate.md) — 架构决策
- [ADR-0004：本地控制面与 callback grant](./architecture/adr/0004-local-control-plane-and-callback-grants.md) — 架构决策
- [ADR-0005：可重放事件流与 UI 投影](./architecture/adr/0005-durable-event-stream-and-ui-projection.md) — 架构决策

## 实施与验收记录

带日期的完成证据，不承担未来路线维护。

- [R0.8 A2A isolation 验收记录（2026-07-22）](./acceptance/r0.8-a2a-isolation-acceptance-2026-07-22.md) — 验收记录
- [R0.9 文档真相源校正验收记录（2026-07-22）](./acceptance/r0.9-doc-truth-source-acceptance-2026-07-22.md) — 验收记录
- [R0.10 文档 metadata/lint 验收记录（2026-07-22）](./acceptance/r0.10-doc-governance-acceptance-2026-07-22.md) — 验收记录
- [A2A 输出隔离结构性升级 — 分步开发文档](./architecture/a2a-isolation-upgrade-implementation.md) — 实施记录

## 调研与理论参考

用于理解背景，不代表当前产品承诺。

- [A2A 路由与输出隔离：TheTower vs 猫咖（clowder-ai）对比](./architecture/a2a-routing-output-isolation-comparison.md) — 调研
- [TheTower Agent 交互协议：理论说明](./architecture/agent-interaction-protocol.md) — 理论说明
- [Cat Cafe / Clowder AI 产品架构与技术方案调研报告](./architecture/cat-cafe-product-architecture-research.md) — 调研
- [猫咖（clowder-ai）Skill 与 MCP 工具差距分析与补充建议](./architecture/clowder-skill-mcp-gap-analysis.md) — 调研

## 历史设计与 Phase

已被替代，仅保留设计背景和实施历史。

- [多 Agent 平台通信内核架构设计](./architecture/multi-agent-communication-architecture.md) — 设计方案
- [Agent 状态栏设计方案](./design/agent-status-bar-design.md) — 设计方案
- [对话级工作目录生产级方案](./design/agent-working-directory-selection-plan.md) — 设计方案
- [AI 输出 Markdown 渲染方案](./design/ai-markdown-rendering-plan.md) — 设计方案
- [TheTower 架构可靠性与交互整改开发计划](./design/architecture-reliability-remediation-plan.md) — 设计方案
- [Claude Code CLI 接入计划](./design/claude-code-cli-integration-plan.md) — 设计方案
- [TheTower 协作上下文与 Skills 升级方案](./design/collaboration-context-and-skills-upgrade-plan.md) — 设计方案
- [Agent Context Delivery 与 Token Observability 最终落地方案](./design/context-delivery-and-token-observability-plan.md) — 设计方案
- [Provider Token Usage 设计方案](./design/provider-token-usage-design.md) — 设计方案
- [TheTower 前端视觉与页面设计方案：Destiny 2 风格](./frontend/destiny-2-frontend-design.md) — 前端
- [TheTower 前端开发总控文档](./frontend/frontend-development-plan.md) — 前端
- [新建 Thread 弹窗化开发文档](./frontend/frontend-new-thread-dialog.md) — 前端
- [Agent Runtime Status：一步到位阶段方案](./phases/agent-status/agent-status-runtime-phases.md) — Phase 记录
- [Phase 1：Skills 基础设施](./phases/collaboration/phase-1-skills-infrastructure.md) — Phase 记录
- [Phase 2：Message 可见性模型](./phases/collaboration/phase-2-message-visibility.md) — Phase 记录
- [Phase 3：ContextBuilder 统一上下文入口](./phases/collaboration/phase-3-context-builder.md) — Phase 记录
- [Phase 4：Callback 与 MCP 可见性升级](./phases/collaboration/phase-4-callback-mcp-visibility.md) — Phase 记录
- [Phase 5：A2A 协作治理与 UI 完成态](./phases/collaboration/phase-5-a2a-governance-ui.md) — Phase 记录
- [Phase 6：A2A 通道语义与去重重构](./phases/collaboration/phase-6-a2a-channel-semantics.md) — Phase 记录
- [Frontend Phase 1：Next Shell 与设计系统底座](./phases/frontend/frontend-phase-1-next-shell-design-system.md) — Phase 记录
- [Frontend Phase 2：Command 首页工作台](./phases/frontend/frontend-phase-2-command-workbench.md) — Phase 记录
- [Frontend Phase 3：Agent 配置治理](./phases/frontend/frontend-phase-3-agent-configuration.md) — Phase 记录
- [Frontend Phase 4：Telemetry 与 Thread Context](./phases/frontend/frontend-phase-4-telemetry-context.md) — Phase 记录
- [Frontend Phase 5：Workspace 与工具活动](./phases/frontend/frontend-phase-5-workspace-tool-activity.md) — Phase 记录
- [Frontend Phase 6：Tasks / Mission 与 Settings 收口](./phases/frontend/frontend-phase-6-tasks-settings.md) — Phase 记录
- [TheTower 分阶段开发索引](./phases/README.md) — Phase 记录
- [Workspace Phase 1：路径安全与 Workspace 底座](./phases/workspace/workspace-phase-1-security-foundation.md) — Phase 记录
- [Workspace Phase 2：Thread projectPath 绑定](./phases/workspace/workspace-phase-2-thread-binding.md) — Phase 记录
- [Workspace Phase 3：Invocation WorkspaceResolver](./phases/workspace/workspace-phase-3-invocation-resolver.md) — Phase 记录
- [Workspace Phase 4：Codex / Claude Provider 对齐](./phases/workspace/workspace-phase-4-provider-alignment.md) — Phase 记录
- [Workspace Phase 5：Session Workspace Guard](./phases/workspace/workspace-phase-5-session-guard.md) — Phase 记录
- [Workspace Phase 6：前端 Workspace 体验](./phases/workspace/workspace-phase-6-frontend-experience.md) — Phase 记录
- [Workspace Phase 7：平台托管 MCP 文件工具](./phases/workspace/workspace-phase-7-managed-mcp-tools.md) — Phase 记录

_Metadata schema v1；共管理 53 份文档。_
