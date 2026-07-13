# TheTower 文档索引

本目录按类别组织：架构调研、设计方案、前端、分阶段开发。

## 项目路线

- [TheTower Roadmap](./ROADMAP.md) — 后续阶段、依赖、验收标准与最近三个 Sprint

## 架构与调研（`architecture/`）

- [多 Agent 平台通信内核架构设计](./architecture/multi-agent-communication-architecture.md)
- [当前 A2A 整体架构说明](./architecture/current-a2a-architecture.md)
- [当前项目架构文档](./architecture/current-project-architecture.md)
- [ADR-0001：Invocation 状态语义](./architecture/adr/0001-invocation-state-semantics.md)
- [ADR-0002：消息通道与回调边界](./architecture/adr/0002-message-channel-boundaries.md)
- [ADR-0003：Provider 与路由能力门禁](./architecture/adr/0003-provider-and-route-capability-gate.md)
- [ADR-0004：本地控制面与 callback grant](./architecture/adr/0004-local-control-plane-and-callback-grants.md)
- [ADR-0005：可重放事件流与 UI 投影](./architecture/adr/0005-durable-event-stream-and-ui-projection.md)
- [Agent 交互协议：理论说明](./architecture/agent-interaction-protocol.md)
- [Cat Cafe / Clowder AI 产品架构与技术方案调研报告](./architecture/cat-cafe-product-architecture-research.md)

## 设计方案（`design/`）

- [架构可靠性与交互整改开发计划](./design/architecture-reliability-remediation-plan.md)
- [能力矩阵](./design/capability-matrix.md)
- [协作上下文与 Skills 升级方案](./design/collaboration-context-and-skills-upgrade-plan.md)
- [Claude Code CLI 接入计划](./design/claude-code-cli-integration-plan.md)
- [对话级工作目录生产级方案](./design/agent-working-directory-selection-plan.md)
- [Agent 状态栏设计方案](./design/agent-status-bar-design.md)
- [Provider Token Usage 设计方案](./design/provider-token-usage-design.md)
- [Agent Context Delivery 与 Token Observability 最终落地方案](./design/context-delivery-and-token-observability-plan.md)
- [AI 输出 Markdown 渲染方案](./design/ai-markdown-rendering-plan.md)

## 前端（`frontend/`）

- [前端开发总控文档](./frontend/frontend-development-plan.md)
- [前端视觉与页面设计方案：Destiny 2 风格](./frontend/destiny-2-frontend-design.md)

## 分阶段开发（`phases/`）

阶段总索引见 [phases/README.md](./phases/README.md)，按子项目拆分：

- **协作上下文 / Skills**（来源：协作上下文与 Skills 升级方案）：[phases/collaboration/](./phases/collaboration/)
- **Workspace 生产级**（来源：对话级工作目录生产级方案）：[phases/workspace/](./phases/workspace/)
- **Agent Runtime Status**（来源：Agent 状态栏设计方案）：[phases/agent-status/](./phases/agent-status/)
- **Frontend 产品化**（来源：前端开发总控文档）：[phases/frontend/](./phases/frontend/)
