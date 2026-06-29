# Workspace Phase 4：Codex / Claude Provider 对齐

## 目标

让真实 CLI provider 使用 Phase 3 传入的 `workingDirectory`，并把 MCP / sandbox 授权边界同步到 thread workspace。

## Codex 行为

目标：

```text
spawn cwd = workingDirectory
codex exec --cd workingDirectory
MCP ALLOWED_WORKSPACE_DIRS = workingDirectory
```

要求：

1. `workingDirectory` 来自 `AgentRunInput`。
2. `CODEX_RUNNER_CWD` 只作为 policy 允许时的 fallback，不用于真实 coding provider 的无 workspace 情况。
3. MCP server 路径从 TheTower runtime root 解析，不能从用户项目目录解析。
4. per-invocation MCP env 注入 callback env 和 `ALLOWED_WORKSPACE_DIRS`。
5. workspace-write sandbox 时同步 allowed workspace / network proxy 配置。

## Claude 行为

目标：

```text
spawn cwd = workingDirectory
stdin prompt
MCP config 使用 TheTower runtime server
```

要求：

1. prompt 不放 argv。
2. 日志可以记录 cwd，但 token / secret 必须脱敏。
3. 如果后续 Claude CLI 提供显式 workspace 参数，优先使用官方参数并保留 spawn cwd。

## 统一解析函数

新增：

```text
packages/api/src/agents/runners/WorkingDirectory.ts
```

```ts
export function resolveInvocationWorkingDirectory(input: AgentRunInput, fallbackCwd: string): string {
  const value = input.workingDirectory?.trim();
  return value ? value : fallbackCwd;
}
```

注意：真实 coding provider 是否允许 fallback 由 Phase 3 policy 控制，runner 只做机械解析。

## 主要文件

- `packages/api/src/agents/runners/WorkingDirectory.ts`
- `packages/api/src/agents/runners/CodexCliRunner.ts`
- `packages/api/src/agents/runners/ClaudeCliRunner.ts`
- `packages/api/src/agents/runners/CallbackRuntimeEnv.ts`

## 开发任务

1. Codex spawn options 使用 `workingDirectory`。
2. Codex `--cd` 使用 `workingDirectory`。
3. Codex MCP env 增加 `ALLOWED_WORKSPACE_DIRS`。
4. Claude spawn options 使用 `workingDirectory`。
5. runner tests 覆盖 cwd、`--cd`、MCP env。
6. 错误信息保留 cwd 相关上下文，但不泄漏 credential。

## 验收标准

- Codex 子进程实际 cwd 是 thread workspace。
- Codex CLI 参数 `--cd` 是 thread workspace。
- Codex MCP env 中 `ALLOWED_WORKSPACE_DIRS` 是 thread workspace。
- Claude 子进程实际 cwd 是 thread workspace。
- 无合法 workspace 的真实 coding provider 在 Phase 3 已被拦截，不会走到 runner fallback。

## 测试建议

```bash
cd packages/api
node --import tsx --test test/CodexCliRunner.test.ts test/ClaudeCliRunner.test.ts
```

## 不做事项

- 不接 Gemini / Antigravity。
- 不做 session resume guard。
