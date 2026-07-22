# Workspace Phase 6：前端 Workspace 体验

> 文档状态：Superseded（历史 Phase 记录）
> 当前来源：[前端页面说明](../../frontend/frontend-pages-guide.md)、[能力矩阵](../../design/capability-matrix.md)
> 本文不再表示当前前端结构、实现状态或开发顺序。

## 目标

让用户在新开项目 / 对话时明确选择工作目录，并在整个对话生命周期中清楚看到所有 Agent 将在哪个 workspace 中运行。

## 已确认决策

- 第一版先使用文本输入，不强制 Electron directory picker。
- 后端严格 validate。
- workspace 初期 name 使用目录 `basename`。
- 后续支持用户重命名 workspace。

## 新建对话

当 `selectedThreadId === undefined` 时，输入区显示：

```text
Working directory
[/Users/xuchenyang/]
Used by all agents in this thread
```

发送第一条消息时：

```ts
client.postUserMessage({
  content,
  projectPath,
});
```

如果后端 validation 失败，UI 展示可操作错误。

## Thread Header

已选 thread 顶部显示：

```text
Project: TheTower
Path: /Users/xuchenyang/
Mode: debug
```

修改 projectPath 必须显式进入设置状态，并提示：

```text
Changing the project path affects future agent runs in this thread. Existing messages are not rewritten.
```

## Thread List

thread row 增加 workspace label：

```text
Implement callback MCP
TheTower · debug
```

没有绑定 projectPath 的旧 thread 显示：

```text
No workspace · debug
```

## Workspace 列表

前端使用：

```text
GET /api/workspaces
POST /api/workspaces/validate
POST /api/workspaces
```

第一版可只提供文本输入 + 最近 workspace 下拉，不做系统目录选择器。

## 主要文件

- `packages/web/src/App.tsx`
- `packages/web/src/styles.css`
- `packages/sdk/src/index.ts`
- `packages/shared/src/index.ts`

## 开发任务

1. SDK 增加 workspace API。
2. SDK `postUserMessage` 支持 `projectPath` / `workspaceId`。
3. 新建 thread UI 增加 workspace 文本输入。
4. Thread header 展示 workspace label/path。
5. PATCH thread 支持修改 / 清除 projectPath。
6. Thread list 展示 workspace label。
7. 展示 validation error。

## 验收标准

- 用户新建 thread 时可以填写 `/Users/xuchenyang/ai/TheTower`。
- 创建成功后 thread header 显示 `TheTower` 和完整 path。
- 继续发送消息不会改变 workspace。
- 修改 workspace 有明确提示。
- validation 失败时不创建 thread，并展示错误。

## 测试建议

优先运行：

```bash
pnpm lint
```

如果后续引入前端测试，再补充 workspace UI 行为测试。

## 不做事项

- 不做 Electron directory picker。
- 不做 workspace 重命名 UI。
- 不做复杂项目看板。
