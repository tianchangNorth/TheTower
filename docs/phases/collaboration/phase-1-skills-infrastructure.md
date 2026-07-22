# Phase 1：Skills 基础设施

> 文档状态：Superseded（历史 Phase 记录）
> 当前来源：[当前 A2A 架构](../../architecture/current-a2a-architecture.md)、[能力矩阵](../../design/capability-matrix.md)
> 本文不再表示当前实现状态或开发顺序。

## 目标

先把协作行为协议层搭起来，让 Agent 的交接、接球、review、收尾不再依赖散落在代码里的硬编码 prompt。

Phase 1 的核心不是新增通信能力，而是让通信行为可治理。

## 当前状态

当前项目已经完成 Phase 1 的主体实现：

- `skills/manifest.yaml`
- 多个内置 `SKILL.md`
- `SkillRegistry`
- `SkillResolver`
- `ResolvedSkill`
- `CliPromptBuilder` 注入 active skills
- `CommunicationService` 调用 runner 时传入 active skills

后续 Phase 1 只需要补强，不应再把协作规则写回 runner 硬编码 prompt。

## 设计边界

Skills 负责：

- 告诉 Agent 什么时候应该交接。
- 告诉 Agent 如何接球。
- 告诉 Agent 如何发起 review。
- 告诉 Agent 如何处理 review。
- 告诉最后一个 Agent 如何做 quality gate。

Skills 不负责：

- 修改 message 可见性。
- 决定哪个 Agent 真正可见哪些消息。
- 直接执行路由。
- 替代 callback / MCP 工具。

## 主要文件

- `skills/manifest.yaml`
- `skills/thread-orchestration/SKILL.md`
- `skills/cross-agent-handoff/SKILL.md`
- `skills/receive-handoff-grounding/SKILL.md`
- `skills/quality-gate/SKILL.md`
- `skills/request-review/SKILL.md`
- `skills/receive-review/SKILL.md`
- `skills/context-self-management/SKILL.md`
- `packages/api/src/skills/SkillRegistry.ts`
- `packages/api/src/skills/SkillResolver.ts`
- `packages/api/src/agents/runners/CliPromptBuilder.ts`
- `packages/shared/src/index.ts`

## 开发任务

1. 保持 `skills/manifest.yaml` 作为 skill 路由真相源。
2. 保持每个 skill 以 `SKILL.md` 为主要内容。
3. 清理 runner 中重复的协作 SOP 硬编码。
4. 补充 skill 触发测试：
   - always-on skill
   - handoff skill
   - receive handoff skill
   - final agent quality gate skill
   - review 相关 skill
5. 确保 active skills 在 runner prompt 中可见。

## 验收标准

- Agent A 需要交给 Agent B 时，prompt 中包含 `cross-agent-handoff`。
- Agent B 被 Agent A 唤醒时，prompt 中包含 `receive-handoff-grounding`。
- Worklist 最后一个 Agent 的 prompt 中包含 `quality-gate`。
- runner prompt 中没有重复的大段 A2A SOP 硬编码。
- 新增 skill 不需要修改 runner 主逻辑。

## 测试建议

优先运行：

```bash
pnpm lint
```

API 定向测试：

```bash
cd packages/api
node --import tsx --test test/SkillResolver.test.ts test/CodexCliRunner.test.ts test/ClaudeCliRunner.test.ts
```

## 不做事项

- 不做 skill marketplace。
- 不做图形化 skill 编辑器。
- 不做远程 skill 安装。
- 不把 visibility 逻辑放进 skill。
