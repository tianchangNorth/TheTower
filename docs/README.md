# TheTower 文档索引

本目录按“当前真相源、决策、运行手册、历史设计”分层。文件名含 `current` 不足以证明内容有效；判断当前能力时必须遵循下表优先级。

## 文档真相源

| 问题 | 唯一优先入口 | 说明 |
| --- | --- | --- |
| 当前是否支持某能力 | [能力矩阵](./design/capability-matrix.md) | 必须同时有实现、自动化证据和发布口径 |
| 当前系统如何工作 | [当前项目架构](./architecture/current-project-architecture.md)、[当前 A2A 架构](./architecture/current-a2a-architecture.md) | 只描述当前代码，不承诺未来能力 |
| 后续做什么、先后顺序 | [技术 Roadmap](./ROADMAP.md) | Epic、依赖与验收标准 |
| 为什么做出关键决策 | [ADR](./architecture/adr/) | 已接受的架构约束；新 ADR 可替代旧 ADR |
| 如何运行发布验收 | [Runbooks](./runbooks/) 与 [Acceptance](./acceptance/) | 操作步骤与带日期的验收证据 |
| 页面当前有什么 | [前端页面说明](./frontend/frontend-pages-guide.md) | 已实现与占位能力，不维护路线优先级 |

状态约定：

- `Current`：当前事实源，需要随代码同步更新；
- `Accepted`：已接受的 ADR；
- `Completed record`：已完成实施或验收记录，仅记录当时证据；
- `Reference`：调研或理论材料，不代表产品承诺；
- `Superseded`：历史方案，不得用于判断当前实现或优先级。

## 项目路线

- [TheTower Roadmap](./ROADMAP.md) — 后续阶段、依赖、验收标准与最近三个 Sprint
- [产品成熟度路线图](./PRODUCT_MATURITY_ROADMAP.md) — 从可信 MVP 到成熟产品的缺口、优先级、发布门槛与阶段指标

## 当前架构、决策与验收

- [当前 A2A 整体架构说明](./architecture/current-a2a-architecture.md)
- [当前项目架构文档](./architecture/current-project-architecture.md)
- [能力矩阵](./design/capability-matrix.md)
- [R0.8 A2A isolation 验收手册](./runbooks/r0.8-a2a-isolation-acceptance.md)
- [R0.8 A2A isolation 验收记录（2026-07-22）](./acceptance/r0.8-a2a-isolation-acceptance-2026-07-22.md)
- [R0.9 文档真相源校正验收记录（2026-07-22）](./acceptance/r0.9-doc-truth-source-acceptance-2026-07-22.md)
- [ADR-0001：Invocation 状态语义](./architecture/adr/0001-invocation-state-semantics.md)
- [ADR-0002：消息通道与回调边界](./architecture/adr/0002-message-channel-boundaries.md)
- [ADR-0003：Provider 与路由能力门禁](./architecture/adr/0003-provider-and-route-capability-gate.md)
- [ADR-0004：本地控制面与 callback grant](./architecture/adr/0004-local-control-plane-and-callback-grants.md)
- [ADR-0005：可重放事件流与 UI 投影](./architecture/adr/0005-durable-event-stream-and-ui-projection.md)

## 调研与理论参考（`architecture/`）

- [Agent 交互协议：理论说明](./architecture/agent-interaction-protocol.md)
- [A2A 路由与输出隔离对比](./architecture/a2a-routing-output-isolation-comparison.md)
- [Cat Cafe / Clowder AI 产品架构与技术方案调研报告](./architecture/cat-cafe-product-architecture-research.md)
- [Clowder Skill / MCP 差距分析](./architecture/clowder-skill-mcp-gap-analysis.md)

## 历史设计记录（`design/`）

以下文档均保留设计背景，但已标记 `Superseded`；当前状态回到能力矩阵，未来顺序回到 Roadmap：

- [早期多 Agent 通信内核设计](./architecture/multi-agent-communication-architecture.md)
- [架构可靠性与交互整改开发计划](./design/architecture-reliability-remediation-plan.md)
- [协作上下文与 Skills 升级方案](./design/collaboration-context-and-skills-upgrade-plan.md)
- [Claude Code CLI 接入计划](./design/claude-code-cli-integration-plan.md)
- [对话级工作目录生产级方案](./design/agent-working-directory-selection-plan.md)
- [Agent 状态栏设计方案](./design/agent-status-bar-design.md)
- [Provider Token Usage 设计方案](./design/provider-token-usage-design.md)
- [Agent Context Delivery 与 Token Observability 最终落地方案](./design/context-delivery-and-token-observability-plan.md)
- [AI 输出 Markdown 渲染方案](./design/ai-markdown-rendering-plan.md)

## 前端

- [当前前端页面功能说明](./frontend/frontend-pages-guide.md)
- [历史前端开发总控文档](./frontend/frontend-development-plan.md)（Superseded）
- [历史视觉与页面设计方案](./frontend/destiny-2-frontend-design.md)（Superseded）
- [历史新建 Thread 弹窗方案](./frontend/frontend-new-thread-dialog.md)（Superseded）

## 分阶段开发（`phases/`）

阶段文档是实施历史，不再表达当前路线。归档索引见 [phases/README.md](./phases/README.md)：

- **协作上下文 / Skills**（来源：协作上下文与 Skills 升级方案）：[phases/collaboration/](./phases/collaboration/)
- **Workspace 生产级**（来源：对话级工作目录生产级方案）：[phases/workspace/](./phases/workspace/)
- **Agent Runtime Status**（来源：Agent 状态栏设计方案）：[phases/agent-status/](./phases/agent-status/)
- **Frontend 产品化**（来源：前端开发总控文档）：[phases/frontend/](./phases/frontend/)
