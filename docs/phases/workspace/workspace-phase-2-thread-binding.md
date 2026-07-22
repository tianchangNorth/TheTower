# Workspace Phase 2：Thread projectPath 绑定

> 文档状态：Superseded（历史 Phase 记录）
> 当前来源：[当前项目架构](../../architecture/current-project-architecture.md)、[能力矩阵](../../design/capability-matrix.md)
> 本文不再表示当前安全默认值、实现状态或开发顺序。

## 目标

让每个开发对话显式绑定一个项目路径。Thread 持久化 `projectPath`，后续 invocation 以此解析 `workingDirectory`。

## 当前状态

TheTower 的 `Thread` 目前只有：

```ts
id
title
mode
createdAt
updatedAt
```

缺少项目归属，无法表达“这个对话属于哪个工作目录”。

## 数据模型

扩展 `Thread`：

```ts
export interface Thread {
  id: string;
  title: string;
  mode?: ThreadMode;
  projectPath?: string;
  createdAt: number;
  updatedAt: number;
}
```

SQLite：

```sql
ALTER TABLE threads ADD COLUMN project_path TEXT;
```

## API

扩展新建消息请求：

```ts
export interface PostUserMessageRequest {
  threadId?: string;
  content: string;
  projectPath?: string;
  workspaceId?: string;
  targetAgents?: string[];
  routeMode?: A2ARouteMode;
}
```

规则：

1. `threadId` 为空时允许传 `projectPath` 或 `workspaceId`。
2. 新 thread 创建前必须 validate project path。
3. `threadId` 已存在时，普通发消息不得隐式修改 `projectPath`。
4. 修改已有 thread 的 `projectPath` 只能走 PATCH thread。

扩展 PATCH thread：

```ts
export interface UpdateThreadRequest {
  mode?: ThreadMode;
  projectPath?: string | null;
}
```

规则：

1. `projectPath` 非空时必须 validate。
2. `projectPath: null` 表示清除绑定。
3. 清除绑定后，真实 coding provider 后续应 fail closed；`mock` 继续运行。

## 主要文件

- `packages/shared/src/index.ts`
- `packages/api/src/db/schema.ts`
- `packages/api/src/stores/ThreadStore.ts`
- `packages/api/src/routes.ts`
- `packages/api/src/services/CommunicationService.ts`

## 开发任务

1. 扩展 shared `Thread` 和 request 类型。
2. DB migration 增加 `threads.project_path`。
3. `ThreadStore.create/get/list/update` 支持 `projectPath`。
4. 新 thread 创建时解析 `workspaceId` 或 validate `projectPath`。
5. 已有 thread 发消息时禁止隐式改 workspace。
6. PATCH thread 支持修改 / 清除 `projectPath`。

## 验收标准

- 新建 thread 可以绑定 `/Users/xuchenyang/ai/TheTower`。
- `GET /api/threads` 返回 `projectPath`。
- 对已有 thread 继续发消息不会改变 `projectPath`。
- PATCH thread 可以修改 `mode`，也可以修改 `projectPath`。
- 清除 `projectPath` 后 thread 仍存在，后续 provider 策略由 Phase 3 控制。

## 测试建议

```bash
cd packages/api
node --import tsx --test test/ThreadStore.test.ts test/CommunicationService.test.ts
```

## 不做事项

- 不在本阶段调用 runner。
- 不做 session workspace guard。
