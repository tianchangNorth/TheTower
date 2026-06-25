---
name: cross-agent-handoff
description: >
  跨 Agent 传话/交接的五件套结构（What/Why/Tradeoff/Open Questions/Next Action）。
  Use when: 交接工作给其他 Agent、传话、写 review 请求。
  Not for: 自己继续执行、不涉及其他 Agent 的普通回复。
  Output: 结构化交接消息。
triggers:
  - "交接"
  - "传话"
  - "handoff"
  - "review"
---

# Cross Agent Handoff

核心原则：交接不能只写“做了什么”。没有 Why / Tradeoff / Open Questions，接手方无法判断边界，只能重新调查。

## 何时使用

使用：

- 你完成了自己部分，需要另一个 Agent 继续。
- 你需要 reviewer 检查某个实现、方案或结论。
- 你要把一个明确子任务交给更合适的 Agent。
- 你发现当前任务需要协调者最终汇总。

不要使用：

- 只是确认、致谢、寒暄。
- 只是提到某个 Agent 的名字。
- 任务已经完成，不需要任何人继续行动。
- 你没有给出可执行的 Next Action。

## 五件套

每次交接、传话、review 请求必须包含：

- What：当前已经完成什么，或做出了什么决策。
- Why：为什么这样做，目标、约束、风险是什么。
- Tradeoff：考虑过什么备选方案，为什么没有选。
- Open Questions：仍不确定的问题；没有则写“无”。
- Next Action：希望接手方具体做什么。

## 发送前检查

```text
1. SCAN：是否真的需要另一个 Agent 行动？
2. TARGET：目标 Agent 是否是最合适的人？
3. FIVE：五件套是否齐全？
4. ACTION：Next Action 是否可执行、可验证？
5. ROUTE：mention 是否在独立行行首？
```

如果任一项不满足，不要交接，先补齐。

## 路由要求

- A2A 交接必须使用行首 mention，例如：`@ikora 请 review ...`。
- 不要在确认、致谢、总结完成时继续 mention。
- 不要用句中 `@handle` 承担交接含义；句中提到队友只作为普通文字。
- 如果交接信息不完整，先补齐五件套，再发给对方。

## Block 场景

### 只写 What

```md
@banshee 我改完了，帮我看看。
```

应阻止。缺少 Why / Tradeoff / Open Questions / Next Action。Reviewer 不知道重点，也无法判断方案是否正确。

### 只有情绪或评价

```md
@shaxx 这个方案应该挺好，你确认下。
```

应阻止。没有可验证上下文，也没有明确检查项。

### 完成后继续 ping

```md
@zavala 收到，已经完成。
```

应阻止。这会触发无意义路由。

## 模板

```md
@<agent-id> 请继续处理/审查：

### What
...

### Why
...

### Tradeoff
...

### Open Questions
...

### Next Action
...
```

## 高质量示例

```md
@ikora 请 review 当前 Skills 触发方案。

### What
我新增了 `SkillRegistry` 和 `SkillResolver`，从 `skills/manifest.yaml` 读取触发规则，并把 resolved skills 注入 Agent prompt。

### Why
之前 A2A 规则写死在 PromptBuilder，后续扩展 review / quality gate / context 管理会继续膨胀，缺少单一真相源。

### Tradeoff
没有引入完整插件系统，也没有做 UI 编辑器；先用文件型 manifest，保持实现小而可验证。

### Open Questions
- 是否需要支持 skill 间依赖自动展开？
- 是否要限制每次注入的 skill 数量，避免 prompt 过长？

### Next Action
请重点检查 manifest 解析边界、触发规则是否会误触发，以及哪些硬规则仍应留在代码里。
```

## 下一步

- 接收方处理交接时使用 `receive-handoff-grounding`。
- 请求 review 时同时满足本 skill 和 `request-review`。
- 如果交接后你是最后一棒，完成前使用 `quality-gate`。
