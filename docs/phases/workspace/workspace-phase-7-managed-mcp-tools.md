# Workspace Phase 7：平台托管 MCP 文件工具

> 文档状态：Superseded（历史 Phase 记录）
> 当前来源：[当前项目架构](../../architecture/current-project-architecture.md)、[能力矩阵](../../design/capability-matrix.md)
> 本文不再表示当前 MCP profile、安全默认值、实现状态或开发顺序。

## 目标

把“读文件 / 写文件 / 列目录”从各个 CLI provider 自带的权限系统中抽出来，改为 TheTower 平台托管 MCP 工具。

第一版先解决当前暴露的问题：

- Claude CLI Agent 创建文件时触发 CLI 自己的权限弹窗，TheTower 无法统一审批、审计和限制。

完成本阶段后，所有真实 coding provider 在 thread workspace 已绑定时都应看到同一事实：

```text
当前 thread workspace = Thread.projectPath 校验后的 workingDirectory
当前 Agent 可通过 TheTower MCP 文件工具在此 workspace 内读写文件
```

## 问题定义

### 1. 写文件依赖 CLI 权限弹窗

如果 Claude / Codex / Gemini 各自调用本地工具写文件，权限边界由 provider 自己决定：

- TheTower 不能统一做 allowed workspace 校验。
- TheTower 不能统一拒绝危险路径。
- TheTower 不能稳定记录审计事件。
- 不同 provider 的交互体验不一致。

这会导致用户看到“Agent 在 TheTower 中运行”，但实际文件权限由 CLI 外部弹窗控制。

### 2. MCP allowed dirs 不能只靠 MCP 进程环境

猫咖的直接文件工具使用 `ALLOWED_WORKSPACE_DIRS` 做路径边界，这是有价值的参考。但 TheTower 的长期目标应更严格：

```text
MCP server 只做工具 schema 和 callback client
真实文件操作在 TheTower API 内完成
API 根据 invocation -> thread -> workspace 解析权限边界
```

这样 MCP 进程即使被错误启动，也不能绕过 thread workspace。

## 猫咖参考

猫咖 MCP server 的核心不是某个单独工具，而是一套可扩展的工具面架构：

```text
packages/mcp-server/src/
  index.ts             legacy all-in-one entrypoint
  collab.ts            协作工具入口
  memory.ts            记忆 / 证据工具入口
  signals.ts           signal 工具入口
  finance.ts           finance 工具入口
  audio.ts             audio 工具入口
  server-toolsets.ts   工具分组、白名单、annotations、注册器
  tools/
    index.ts           聚合导出所有工具模块
    callback-tools.ts  thread/message/callback 类工具
    file-tools.ts      文件读写/切片/list 工具
    shell-tools.ts     受限 shell 工具
    ...
  utils/
    path-validator.ts  allowed dirs / realpath 校验
    path-utils.ts      路径工具函数
```

每个 `tools/*` 模块基本遵循同一模式：

```ts
export const someInputSchema = { ...zod fields... };

export async function handleSomeTool(input: SomeInput): Promise<ToolResult> {
  // validate / call backend / format result
}

export const someTools = [
  {
    name: "cat_cafe_some_tool",
    description: "...",
    inputSchema: someInputSchema,
    handler: handleSomeTool,
  },
] as const;
```

`tools/index.ts` 只负责聚合导出，`server-toolsets.ts` 再按工具面组合：

```text
COLLAB_TOOL_SOURCES = callbackTools + hubActionTools + shellTools + ...
MEMORY_TOOL_SOURCES = evidenceTools + fileSliceTools + graphTools + ...
```

然后统一经过：

```text
applyReadonlyFilter
-> infer explicit annotations
-> registerTools(server, tools)
```

这个结构解决了三个问题：

- 工具增长时不会把所有 schema/handler 注册逻辑塞进入口文件。
- 不同客户端可以暴露不同工具面，例如 all-in-one / collab / memory。
- 白名单、权限 mode、annotations 有单一注册层，不散落在每个工具模块。

猫咖 MCP 工具有几个值得直接参考的设计点：

1. 工具分层，而不是所有工具无条件暴露。
2. read-only mode 使用显式白名单。
3. agent-key mode 只增加必要协作写工具。
4. 每个工具显式标注 `readOnlyHint` / `destructiveHint` / `openWorldHint`。
5. 文件工具统一经过路径校验。
6. `shell_exec` 即使是只读，也仍然按破坏性工具对待，使用严格命令白名单。

猫咖中与本阶段最相关的工具：

| 猫咖工具 | 类型 | TheTower 是否第一版参考 |
| --- | --- | --- |
| `cat_cafe_post_message` | 协作写 | 已有类似能力：`post_message` |
| `cat_cafe_get_thread_context` | 协作读 | 已有类似能力：`get_thread_context` |
| `read_file` | 文件读 | 第一版支持 |
| `cat_cafe_read_file_slice` | 有界文件读 | 第一版支持 |
| `write_file` | 文件写 | 第一版支持 |
| `list_files` | 目录读 | 第一版支持 |
| `cat_cafe_shell_exec` | 受限 shell | 不进入第一版，单独阶段做 |

## TheTower 解法

### 架构原则

第一版采用 MCP 工具分层：

```text
协作工具：
Agent -> MCP server -> Callback API

本地 workspace 工具：
Agent -> MCP server -> tools/* -> local filesystem / local spawn
```

关键点：

1. `post_message` / `get_thread_context` 属于平台协作状态，继续走 Callback API。
2. `shell_exec` 属于本地 workspace 能力，参考猫咖在 MCP server 进程内执行。
3. 本地工具的权限边界来自 runner 注入的 `ALLOWED_WORKSPACE_DIRS`。
4. shell 不开放任意命令，只允许受限白名单。
5. 路径参数必须按 realpath 校验，symlink escape 必须拒绝。
6. `shell_exec` 不进入 `read-only` profile，并标记 `destructiveHint: true`。

### MCP Server 目标结构

TheTower 当前 `packages/mcp-server/src/index.ts` 只有少量工具时可以工作，但迁移文件工具后不应继续在入口文件中堆注册逻辑。参考猫咖，第一版就调整为：

```text
packages/mcp-server/src/
  index.ts
  server-toolsets.ts
  tools/
    index.ts
    callback-tools.ts
    file-tools.ts
    shell-tools.ts
    result.ts
```

职责划分：

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 读取 callback env，创建 `AgentCallbackHttpClient`，创建 MCP server，调用 `registerFullToolset` |
| `server-toolsets.ts` | 定义工具分组、tool profile、annotations、统一注册函数 |
| `tools/callback-tools.ts` | `post_message`、`get_thread_context` |
| `tools/file-tools.ts` | `read_file`、`read_file_slice`、`list_files`、`write_file` |
| `tools/shell-tools.ts` | `shell_exec`，本地执行受限命令 |
| `tools/result.ts` | `successResult` / `errorResult` / callback error formatting |
| `tools/index.ts` | 聚合导出工具数组和 schema |

工具定义统一使用内部 `ToolDef`：

```ts
export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: never) => Promise<ToolResult>;
}
```

协作工具 handler 调用 `CallbackClient`。本地 workspace 工具 handler 直接在 MCP server 进程内执行，但必须受 `ALLOWED_WORKSPACE_DIRS` 和工具自身 guard 约束。

### Toolset 分组

第一版 TheTower 不需要复制猫咖的所有入口，但要先建立分组：

```text
COLLAB_TOOL_SOURCES
  post_message
  get_thread_context

WORKSPACE_TOOL_SOURCES
  read_file
  read_file_slice
  list_files
  write_file
  shell_exec

FULL_TOOL_SOURCES
  collab + workspace
```

注册函数：

```ts
export function buildCollabTools(env?: ToolsetEnv): readonly ToolDef[];
export function buildWorkspaceTools(env?: ToolsetEnv): readonly ToolDef[];
export function buildFullTools(env?: ToolsetEnv): readonly ToolDef[];

export function registerCollabToolset(server: McpServer, deps: ToolDeps): void;
export function registerWorkspaceToolset(server: McpServer, deps: ToolDeps): void;
export function registerFullToolset(server: McpServer, deps: ToolDeps): void;
```

`ToolDeps` 第一版只需要：

```ts
interface ToolDeps {
  callbackClient: CallbackClient;
  threadId: string;
}
```

### Tool Profiles

参考猫咖 `READONLY_ALLOWED_TOOLS` / `AGENT_KEY_TOOLS` / desktop mode，TheTower 第一版定义更小的 profile：

| Profile | 适用场景 | 暴露工具 |
| --- | --- | --- |
| `full` | invocation-scoped CLI provider | collab + workspace |
| `collab-only` | 只允许发消息 / 读上下文的 provider | post_message + get_thread_context |
| `read-only` | 后续持久 agent 或外部 connector | get_thread_context + read_file + read_file_slice + list_files |

环境变量：

```text
THE_TOWER_MCP_PROFILE=full | collab-only | read-only
```

规则：

1. 未设置默认 `full`，保持当前动态 invocation MCP 行为。
2. unknown profile fail fast，不静默注册空工具或全量工具。
3. `read-only` 不暴露 `post_message`、`write_file`、`shell_exec`，除非后续增加 agent-key 等显式凭证模式。
4. 新增工具默认不进入 `read-only`，必须显式加入白名单。

### Tool Annotations

参考猫咖 `EXPLICIT_TOOL_ANNOTATIONS`，TheTower 第一版也使用显式表，不做名称前缀推断：

```ts
const A_READ_LOCAL = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
};

const A_WRITE_SAFE = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
};

export const EXPLICIT_TOOL_ANNOTATIONS = {
  post_message: A_WRITE_SAFE,
  get_thread_context: A_READ_LOCAL,
  read_file: A_READ_LOCAL,
  read_file_slice: A_READ_LOCAL,
  list_files: A_READ_LOCAL,
  write_file: A_WRITE_SAFE,
  shell_exec: A_DESTRUCTIVE,
};
```

要求：

1. 每个注册工具必须有 explicit annotation。
2. 测试覆盖“已注册工具”和 annotation 表 1:1。
3. `write_file` 是 non-destructive write，不标 destructive；它会覆盖目标文件，但仍限制在 workspace 内。
4. `shell_exec` 标记 destructive，因为它执行本地进程，即使有白名单也属于高风险面。
5. `openWorldHint` 第一版全部为 false，因为工具只访问 TheTower 本地 API、MCP 本地进程和 workspace。

### Shell Exec 采用猫咖本地执行模型

TheTower 的 `shell_exec` 不走 TheTower API，不新增 `/api/callbacks/tools/shell-exec`。执行链路为：

```text
Agent -> MCP server -> tools/shell-tools.ts -> local spawn(shell=false)
```

安全要求：

1. `ALLOWED_WORKSPACE_DIRS` 必须由 runner 注入，值来自当前 thread workspace。
2. 默认 cwd 选择第一个 allowed workspace，不能使用 `/`。
3. 只允许 `pwd`、`ls`、`cat`、`git log/status/rev-parse/diff/show`、`python3/node workspace-script`。
4. 禁止 shell control chars、变量展开、glob、backslash escape、quoted whitespace。
5. 路径参数做 realpath 校验，拒绝 workspace 外路径和 symlink escape。
6. 使用 `spawn(..., shell: false)`，不通过 `/bin/sh` 解释。
7. 输出截断，命令 timeout。

### Prompt 工具说明

所有 runner prompt 都应说明文件工具边界：

```text
当前 thread 绑定了工作目录时，你可以使用 TheTower MCP 文件工具读写该 workspace 内的文件。
文件工具由 TheTower API 校验 invocation、callback token 和 workspace 边界。
不要尝试通过 CLI 自带写文件能力绕过 TheTower MCP 文件工具。
需要验证脚本时，使用 mcp__thetower__shell_exec；它在 MCP server 本地执行受限命令，并通过 ALLOWED_WORKSPACE_DIRS 校验边界。
```

如果 thread 没有 workspace：

```text
当前 thread 尚未绑定工作目录。
真实 coding provider 应 fail closed；mock provider 可继续运行。
```

### Provider 暴露方式

Claude runner：

```text
--allowedTools mcp__thetower__post_message,
               mcp__thetower__get_thread_context,
               mcp__thetower__read_file,
               mcp__thetower__read_file_slice,
               mcp__thetower__list_files,
               mcp__thetower__write_file,
               mcp__thetower__shell_exec
```

Codex runner：

```text
mcp_servers.thetower.env.THE_TOWER_INVOCATION_ID
mcp_servers.thetower.env.THE_TOWER_CALLBACK_TOKEN
mcp_servers.thetower.env.THE_TOWER_THREAD_ID
mcp_servers.thetower.env.THE_TOWER_AGENT_ID
mcp_servers.thetower.env.ALLOWED_WORKSPACE_DIRS
```

`ALLOWED_WORKSPACE_DIRS` 是 MCP 本地 shell 工具的主权限边界，必须来自 API 侧已校验的 `workingDirectory`。

## 第一版 MCP 工具范围

第一版只支持文件类工具和现有协作工具。

### 已有协作工具

#### `mcp__thetower__post_message`

用途：

- Agent 在执行过程中向当前 thread 发消息。
- 支持 `targetAgents` / `routeMode` / `visibility` / `handoffPayload`。

权限：

- 必须有有效 callback token。
- 必须属于当前 running invocation。

#### `mcp__thetower__get_thread_context`

用途：

- Agent 读取当前 thread 最新可见消息。

权限：

- 必须有有效 callback token。
- 读取结果仍受 `ContextBuilder` / visibility policy 限制。

### 新增文件工具

#### `mcp__thetower__read_file`

输入：

```ts
{
  path: string;
}
```

行为：

- 读取当前 workspace 内 UTF-8 文本文件。
- 大文件拒绝完整读取，提示使用 `read_file_slice`。
- 路径可以是相对路径或绝对路径，但必须在 workspace 内。

建议限制：

- 最大完整读取：`512 KiB`。
- 拒绝目录、二进制文件可后续增强。

#### `mcp__thetower__read_file_slice`

输入：

```ts
{
  path: string;
  startLine: number;
  endLine?: number;
}
```

行为：

- 读取有界行范围。
- 输出带行号，便于 review 和引用。

建议限制：

- 默认 `120` 行。
- 单次最多 `400` 行。

#### `mcp__thetower__list_files`

输入：

```ts
{
  path?: string;
  recursive?: boolean;
}
```

行为：

- 列出 workspace 内目录。
- 目录后缀使用 `/`。
- recursive 模式有最大条目数。

建议限制：

- 默认跳过 `.git`、`node_modules`。
- 最大返回 `1000` 项。

#### `mcp__thetower__write_file`

输入：

```ts
{
  path: string;
  content: string;
}
```

行为：

- 在当前 workspace 内写入 UTF-8 文本。
- 自动创建父目录。
- 覆盖整个文件。

建议限制：

- 最大写入 `2 MiB`。
- 拒绝 `.git` 内路径。
- 第一版不支持 append / patch；需要增量修改时由 Agent 读文件后生成完整内容。

## 第一版不支持的 MCP

### 不支持 `shell_exec`

原因：

- shell 即使只读也有复杂逃逸面：重定向、管道、变量展开、glob、命令替换、引号、symlink。
- 猫咖把 `cat_cafe_shell_exec` 标为 destructive，是正确方向。
- TheTower 应先把文件读写闭环做好，再单独设计 shell executor。

后续如果支持，应单独做：

- 命令 AST / tokenizer。
- 只读命令白名单。
- 禁止 shell control characters。
- cwd realpath 校验。
- path args realpath 校验。
- stdout / stderr 截断。
- timeout。
- 审计事件。
- 危险命令 fail closed。

### 不支持 arbitrary execute command

第一版不提供：

- `npm install`
- `pnpm run`
- `git commit`
- `rm`
- `mv`
- 任意 shell command

这些不进入第一版。后续如果要开放写命令，必须单独设计审批和 destructive policy。

## API 设计

新增 callback endpoints：

```text
POST /api/callbacks/tools/read-file
POST /api/callbacks/tools/read-file-slice
POST /api/callbacks/tools/list-files
POST /api/callbacks/tools/write-file
```

所有请求都携带：

```ts
{
  invocationId: string;
  callbackToken: string;
}
```

服务端流程：

```text
verify callbackToken
-> load invocation
-> require invocation.status === running
-> load thread
-> resolveThreadWorkspace(thread)
-> resolve requested path inside workingDirectory
-> realpath / deepest existing parent validation
-> perform file operation
-> write audit event
```

## 审计事件

第一版至少记录内部事件，后续 UI 再展示：

```ts
{
  type: "workspace.file_tool",
  threadId: string;
  invocationId: string;
  agentId: string;
  tool: "read_file" | "read_file_slice" | "list_files" | "write_file";
  path: string;
  bytes?: number;
  denied?: boolean;
  reason?: string;
  createdAt: number;
}
```

写入类工具必须记录：

- agentId
- invocationId
- threadId
- path
- byte count
- success / failure

## 主要文件

- `packages/api/src/services/WorkspaceFileService.ts`
- `packages/api/src/routes.ts`
- `packages/api/src/events/EventBus.ts`
- `packages/api/src/agents/runners/CliPromptBuilder.ts`
- `packages/api/src/agents/runners/ClaudeCliRunner.ts`
- `packages/api/src/agents/runners/CodexCliRunner.ts`
- `packages/mcp-server/src/index.ts`
- `packages/mcp-server/src/server-toolsets.ts`
- `packages/mcp-server/src/tools/index.ts`
- `packages/mcp-server/src/tools/callback-tools.ts`
- `packages/mcp-server/src/tools/file-tools.ts`
- `packages/mcp-server/src/tools/shell-tools.ts`
- `packages/mcp-server/src/tools/result.ts`
- `packages/mcp-server/test/server.test.ts`
- `packages/mcp-server/test/server-toolsets.test.ts`
- `packages/mcp-server/test/server-toolsets-annotations.test.ts`

## 开发任务

1. 先重构 `@the-tower/mcp-server` 为 `tools/* + server-toolsets.ts`，保持现有 `post_message` / `get_thread_context` 行为不变。
2. 新增 explicit tool annotations 表，并测试所有注册工具都有 annotation。
3. 新增 `THE_TOWER_MCP_PROFILE`，第一版支持 `full` / `collab-only` / `read-only`。
4. 在 prompt 中说明 TheTower MCP 文件工具和权限边界。
5. 新增 `WorkspaceFileService`。
6. 新增 callback file tool endpoints。
7. MCP server 新增 `read_file` / `read_file_slice` / `list_files` / `write_file`。
8. MCP server 新增猫咖式本地 `shell_exec`，不经过 TheTower API。
9. Claude runner `--allowedTools` 加入新增 MCP 工具，并注入 `ALLOWED_WORKSPACE_DIRS`。
10. Codex prompt / MCP config 说明新增工具。
11. 增加文件工具审计事件。
12. 增加 API 单元测试覆盖路径边界。
13. 增加 MCP server 测试覆盖工具注册、profile 过滤、annotations、本地 shell guard 和 callback 转发。

## 验收标准

- 没有绑定 workspace 的真实 coding provider fail closed。
- `read_file` 可以读取 workspace 内文件。
- `write_file` 可以在 workspace 内新建文件。
- `write_file` 拒绝 workspace 外路径。
- `write_file` 拒绝 symlink escape。
- `list_files` 默认不返回 `.git` / `node_modules`。
- Claude CLI 不再依赖自身写文件权限弹窗完成普通 workspace 写文件。
- `shell_exec` 可以运行 workspace 内 `python3/node` 脚本验证。
- `shell_exec` 拒绝 workspace 外路径、shell 控制符、变量展开和危险命令。
- 所有文件工具调用都可通过 callback token 追溯到 invocation。
- `THE_TOWER_MCP_PROFILE=read-only` 不暴露 `write_file` / `post_message`。
- `THE_TOWER_MCP_PROFILE=collab-only` 不暴露文件工具。
- unknown MCP profile 启动失败。
- 所有注册工具都在 `EXPLICIT_TOOL_ANNOTATIONS` 中有显式条目。

## 测试建议

```bash
pnpm --filter @the-tower/api test
pnpm --filter @the-tower/mcp-server test
pnpm lint
```

重点补充：

- `WorkspaceFileService.test.ts`
- `CliPromptBuilder.test.ts`
- `ClaudeCliRunner.test.ts`
- `CodexCliRunner.test.ts`
- `packages/mcp-server/test/server.test.ts`
- `packages/mcp-server/test/server-toolsets.test.ts`
- `packages/mcp-server/test/server-toolsets-annotations.test.ts`

## 后续阶段

本阶段完成后，再设计：

1. TheTower 托管 shell executor。
2. 用户审批 UI。
3. 危险命令拒绝规则。
4. 文件 patch / append 工具。
5. tool event 在前端时间线展示。
6. MCP tool annotations 显式表，参考猫咖 `EXPLICIT_TOOL_ANNOTATIONS`。
