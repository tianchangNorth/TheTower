# Workspace Phase 1：路径安全与 Workspace 底座

> 文档状态：Superseded（历史 Phase 记录）
> 当前来源：[当前项目架构](../../architecture/current-project-architecture.md)、[能力矩阵](../../design/capability-matrix.md)
> 本文不再表示当前安全默认值、实现状态或开发顺序。

## 目标

先建立生产级 workspace 安全底座。后续 Thread 绑定、runner cwd、MCP allowed dirs 都必须依赖这个底座，不能直接信任前端传入的路径。

## 已确认决策

- 默认 allowed root：`/Users/xuchenyang`。
- 第一版允许前端文本输入路径，但后端必须严格校验。
- Workspace 初期 name 用目录 `basename`，后续可重命名。

## 设计边界

本阶段负责：

- 路径规范化。
- allowed / denied roots。
- workspace 持久化。
- workspace validate / create API。

本阶段不负责：

- Thread 绑定 projectPath。
- 调用真实 CLI。
- 前端目录选择器。
- session resume guard。

## 数据模型

新增 `Workspace`：

```ts
export interface Workspace {
  id: string;
  name: string;
  projectPath: string;
  trustedAt: number;
  lastOpenedAt: number;
  createdAt: number;
}
```

SQLite：

```sql
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_path TEXT NOT NULL UNIQUE,
  trusted_at INTEGER NOT NULL,
  last_opened_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```

## 路径校验

新增：

```text
packages/api/src/workspaces/projectPath.ts
```

提供：

```ts
validateProjectPathDetailed(rawPath: string): Promise<
  | { ok: true; path: string }
  | {
      ok: false;
      reason: "missing" | "not_directory" | "outside_allowed_roots" | "denied" | "io_error";
      message?: string;
    }
>;
```

规则：

1. 路径必须解析为绝对路径。
2. 必须存在且是目录。
3. 解析 symlink 后再判断是否在 allowed root 内。
4. 默认 allowed root 是 `/Users/xuchenyang`。
5. 拒绝明显危险位置：`/`、系统目录、credential 目录、`.git` 内部路径、`node_modules`。
6. transient IO error 和永久非法路径要返回不同 reason。

环境变量：

| 变量 | 用途 |
| --- | --- |
| `THE_TOWER_PROJECT_ALLOWED_ROOTS` | 覆盖默认 allowed roots |
| `THE_TOWER_PROJECT_ALLOWED_ROOTS_APPEND` | 将自定义 roots 追加到默认 `/Users/xuchenyang` |
| `THE_TOWER_PROJECT_DENIED_ROOTS` | 额外 denied roots |

## API

新增：

```text
GET  /api/workspaces
POST /api/workspaces
POST /api/workspaces/validate
```

`POST /api/workspaces`：

```ts
{
  projectPath: string;
  name?: string;
}
```

行为：

1. validate 通过后 upsert workspace。
2. `name` 缺省时使用 `basename(projectPath)`。
3. 更新 `lastOpenedAt`。

## 主要文件

- `packages/shared/src/index.ts`
- `packages/api/src/db/schema.ts`
- `packages/api/src/stores/WorkspaceStore.ts`
- `packages/api/src/workspaces/projectPath.ts`
- `packages/api/src/routes.ts`

## 开发任务

1. 新增 `Workspace` shared type。
2. 新增 `workspaces` 表。
3. 实现 `WorkspaceStore`。
4. 实现 `validateProjectPathDetailed`。
5. 新增 Workspace API。
6. 增加路径校验和 store 单元测试。

## 验收标准

- `/Users/xuchenyang/ai/TheTower` 校验通过。
- 不存在路径校验失败。
- 文件路径校验失败。
- `/`、`~/.ssh`、`~/.codex` 等危险路径校验失败。
- symlink escape 校验失败。
- 创建 workspace 时默认 name 为目录 basename。

## 测试建议

```bash
cd packages/api
node --import tsx --test test/ProjectPathValidation.test.ts test/WorkspaceStore.test.ts
```

## 不做事项

- 不做 Electron directory picker。
- 不做 Thread 绑定。
- 不调用真实 Agent。
