# Frontend Phase 3：Agent 配置治理

## 目标

将 Agent 长配置从 Command 首页迁移到 `/agents` 和 `/agents/[agentId]`。Command 首页只保留 Agent 运行摘要和配置入口。

## 前置条件

- Phase 2 完成，Command 首页已不承载 Agent 长表单。
- 后端现有 Agent 数据能支撑 identity / persona 基础读取和更新；缺口通过本 phase 补齐。

## 页面结构

```text
/agents
├─ AgentConfigHeader
├─ AgentConfigList
└─ AgentDetailPanel
   ├─ Overview
   ├─ Persona
   ├─ Model
   ├─ Tools
   ├─ Runtime
   └─ Audit
```

## 后端 / SDK 任务

按最小可落地范围补接口和 SDK：

```text
GET /api/agents/:id/config
PATCH /api/agents/:id/config
GET /api/agents/:id/tools
PATCH /api/agents/:id/tools
GET /api/agents/:id/runtime
PATCH /api/agents/:id/runtime
GET /api/agents/:id/audit
```

第一版如果后端字段尚未完整，`Tools`、`Runtime`、`Audit` 可以只读或占位，但路由和 tab 必须存在。

## 前端任务

1. 实现 `/agents` 列表页。
2. 实现 `/agents/[agentId]` 详情页。
3. 实现 `AgentConfigList`：
   - search
   - enabled filter
   - provider / model summary
   - dirty state indicator
4. 实现 `AgentDetailPanel` tabs：
   - `Overview`：displayName、mentionHandles、enabled、provider、model、身份色、摘要。
   - `Persona`：roleDescription、personality、strengths、restrictions、background、voice、signature。
   - `Model`：provider、model、参数占位、fallback 占位。
   - `Tools`：工具权限矩阵占位或只读版本。
   - `Runtime`：sandbox、approval、timeout、budget 占位或只读版本。
   - `Audit`：最近错误和配置变更占位或只读版本。
5. 实现表单状态：
   - idle
   - dirty
   - saving
   - saved
   - error
6. Command 首页 `Configure` 链接必须能跳到对应 Agent。

## 视觉要求

- 配置页是治理中心，不使用聊天式布局。
- 表单密度要高，标签明确，危险开关必须有视觉警戒。
- Tabs 使用 shadcn/ui/Radix 基础行为，但视觉改成 TheTower HUD token。

## 不做事项

- 不实现复杂权限继承策略编辑器。
- 不暴露 provider secret。
- 不做模型价格实时查询。
- 不做 Agent marketplace。

## 验收标准

- `/agents` 可列出全部 Agent。
- `/agents/[agentId]` 可展示并编辑基础配置。
- 保存成功后 Command 首页 AgentStatusCard 反映新 displayName / enabled / model。
- 离开 dirty 表单前有明确提示或保存状态。
- Tools / Runtime / Audit 即使未完全实现，也有稳定占位和后续接口说明。
- Agent 配置相关 UI 不再出现在 Command 首页。

## 交付文件

- `packages/web/src/app/agents/page.tsx`
- `packages/web/src/app/agents/[agentId]/page.tsx`
- `packages/web/src/components/agents/**`
- `packages/web/src/hooks/useAgentConfig.ts`
- `packages/web/src/stores/agentConfigStore.ts`
- `packages/sdk/src/index.ts`
- `packages/api/src/routes.ts`
