---
name: collaborative-thinking
description: >
  单人或多人创意探索、独立思考、讨论收敛。三种模式：单人探索 / 多 Agent 独立思考 / 收敛沉淀。
  Use when: brainstorm、多 Agent 独立思考、讨论结束需要收敛、方向性问题需要多视角。
  Not for: 已有明确 spec 直接写代码、单个 Agent 执行已定方案。
  Output: 收敛报告（共识/分歧/行动项）+ 收敛三件套检查。
triggers:
  - "brainstorm"
  - "讨论"
  - "多 agent 独立思考"
  - "收敛"
  - "讨论结束"
  - "总结一下"
---

# Collaborative Thinking

三种思考模式：单人探索 / 多 Agent 独立思考 / 讨论收敛沉淀。本 skill 是通用思考框架，不绑定具体功能立项。

## 核心知识

| 模式 | 何时用 | 何时不用 |
|------|--------|----------|
| **A 单人探索** | 1:1 功能设计、想法 → spec | 需要多视角的方向性决策 |
| **B 多 Agent 思考** | 架构选型、流程设计、跨模型互补 | 实现细节、bug 定位（token 成本不值） |
| **C 收敛沉淀** | 任何讨论产出了决策/规则/否决理由 | 纯问答（结论在 thread 里已够）、operator 说"不用记" |

## Mode A: 单人探索 (Brainstorm)

**目标**：将模糊想法转化为可执行 spec，通过增量验证降低返工。

1. **理解上下文**：先读项目现状（文件、文档、近期 commits）。每次只问一个问题，优先多选题。
2. **探索方案**：提出 2-3 个备选 + tradeoffs，先说推荐和理由。**YAGNI 无情剪枝**——"以后可能需要"的功能先砍。
3. **呈现设计**：每次 200-300 字，每段后问"这个方向对吗？"。覆盖：架构 / 组件 / 数据流 / 错误处理 / 测试。
4. **产出**：设计文档写到 `feature-specs/YYYY-MM-DD-{topic}-design.md`，commit 后问"要开始实现了吗？"

## Mode B: 多 Agent 独立思考

> **⚠️ TODO — 当前不可用，待并行 dispatch 能力上线后启用。**
>
> Mode B 要求多 Agent **并行**思考且**互不可见**。TheTower 当前 `CommunicationService.executeWorklist` 是**串行** round-robin（`while currentIndex++`，无 `Promise.all`），后发言的 Agent 会在 thread 里看到前序 Agent 的回复，独立性不成立。`routeMode` 的 `fanout/parallel` 目前只改 prompt 文案，不产生并发。
>
> 启用前置：`executeWorklist` 支持 `Promise.all` 并发 dispatch，且并行阶段各 Agent 的中间产出不落入公共 thread（或落入私有通道）。在此之前，需要多视角的方向性决策请用 Mode A 由当前 Agent 自己列多视角，或串行轮询收集（接受独立性弱化、在 skill 里注明）。

目标态保留如下，供后续启用时对照：

**6 阶段流程**：
```
Phase 1: 独立思考（并行，禁止互看）
Phase 2: 串行讨论（有分歧才触发，限 2-3 轮）
Phase 3: operator 选扇入者
Phase 4: 扇入综合（会议纪要 + 行动项）
Phase 5: 其他 Agent 审阅补充（纠正误读）
Phase 6: operator 反馈 + 最终确认 → 进入 Mode C
```

**Phase 1 独立性保护规则（最重要）**：
- 禁止互看：每个 Agent 独立完成，不预测他人观点
- 防锚定：有背景材料时，先形成自己想法再参考
- 展示推理链："我为什么这么想"，不只给结论
- 标注不确定性：区分确信的结论和猜测

**Phase 4 综合必须包含**：各方观点摘要 / 共识区 / **分歧区**（不要抹平！）/ 待决事项 / 行动项。

**Open Questions 分类（必须拆开）**：
- **技术 OQ**：给 Agent 解决的（实现细节、方案选型中可回滚的部分）
- **价值 OQ**：需要 operator 判断的 → 必须附 Decision Packet（简述各选项 + 取舍 + 推荐理由）

如果所有 OQ 都是技术型且回滚成本低，不升级 operator——Agent 自决 + 事后通报。

**严格档（高 stakes）**：决策不可逆 / 多方案价值取舍 / 方向级·跨多 feature 时启用。门槛宜高，日常 plan 走标准 Mode B，别开严格档（仪式化会贬值）。在 6 阶段之上多守：
1. **沉默 ≠ 同意**：高风险条目上快速全票是危险信号；每个 Agent 要么提反例，要么说清"查了什么才不反对"。
2. **价值题不许技术化逃逸**：任一 Agent 判某条为价值/不可逆/高风险就不能 early-exit，否决须附"理由 + 什么能推翻它"。
3. **分歧不抹平**：Phase 5 升为硬门——被代表的 Agent 必须确认分歧没被扇入者写歪。
4. **不无限续命**：复用 Phase 2 的 2-3 轮上限；超限出 split-options 给 operator 或诚实宣告未收敛。
5. **收敛接 census**：收敛稿 handoff 给实现计划必带 Stateful Object Gate——tradeoff ≠ 完成状态契约。

## Mode C: 收敛沉淀 (Convergence)

任何讨论产出了决策/规则/否决理由时启用。**Mode B 结束后必须进入 Mode C。**

**收敛时 operator 升级检查**：收敛结论中有需要 operator 拍板的 Open Question 时，必须附 Decision Packet。先判断可逆性：回滚成本低的 Agent 自决，不升级。

**收敛三件套——每项必须显式回答"有/没有"，不允许跳过**：

**1. 否决理由 → 记忆**：这次讨论有否决某个技术方案？有 → 写进 auto-memory（reference 类），并在 thread 总结里记一句"否决了 X，因为 Y，推翻条件是 Z"。

**2. 踩坑教训 → 记忆**：这次讨论有暴露新坑？有 → 写进 auto-memory（project/feedback 类），记现象 + 根因 + 规避动作。

**3. 操作规则 → 指引**：这次讨论有产生新的必须遵守的规则？有 → 更新 CLAUDE.md / 对应 skill，或在 auto-memory（feedback 类）里固化。

> TheTower 暂无独立的 ADR / lessons-learned 文件层，三件套统一沉淀到 auto-memory + thread 总结。若未来建立知识库层（见差距分析文档 `clowder-skill-mcp-gap-analysis.md`），再迁入。

**强制回答格式**（附在 thread 总结末尾）：
```
## 收敛检查
1. 否决理由 → 记忆？[有 → 已写 memory / 没有]
2. 踩坑教训 → 记忆？[有 → 已写 memory / 没有]
3. 操作规则 → 指引？[有 → 已更新 CLAUDE.md §xx / 没有]
```

**追溯链**（每次收敛必须建立）：讨论结论在 thread 里留锚点（消息 + 关键词），memory 里 link 回 thread。

**会议纪要模板**（写进 thread 公开 callback 或 feature-specs/）：
```markdown
# {主题} 讨论纪要
Thread ID: `thread_xxx` | 日期: YYYY-MM-DD | 参与者: [列出]

## 背景 / 各方观点 / 共识 / 分歧 / 待决 / 行动项
```

## 输出通道（重要）

收敛报告是过程产物，**完整纪要不要原样贴进公开 callback**。遵循 `a2a-channel-semantics`：

- 完整纪要写进 stdout（私有）或 `feature-specs/` 文件，或通过 `post_message` 设 `visibility="private"` + `handoffPayload` 给接手者。
- 公开 callback 只给一句结论性总结 + 行动项，不贴 `messageId` / `visibility` / `visibleToAgentIds` / `targetAgents` / `routeMode` 等路由元数据。

## Quick Reference

| 你要做的事 | 用哪个 Mode |
|-----------|------------|
| 帮 operator 把想法变成 spec | A |
| 几个 Agent 各自看一个架构方向 | B（**当前不可用，见 TODO**） |
| 不可逆 / 价值取舍 / 方向级的重大决策 | B 严格档（**当前不可用**） |
| 讨论刚结束，要沉淀 | C |
| Mode B 结束后 | **C（必须）** |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Mode A 一次问多个问题 | 拆成多条，每条只问一件事 |
| Mode A 没提备选方案就直接设计 | 先 2-3 个方案 + tradeoffs，再推荐 |
| 在串行 worklist 下假装跑了 Mode B | 当前不支持真并行；改用 Mode A 列多视角，或串行轮询并注明独立性弱化 |
| Mode B 综合时抹平分歧 | 分歧必须保留 + 标注各方理由 |
| Mode C 三件套"感觉没有就跳过" | 必须显式回答每一项"有/没有" |
| Mode C 写了纪要但不留追溯链 | thread 留锚点 + memory link 回 thread |

## 和其他 skill 的关系

- 立项采访和需求澄清走具体功能流程，本 skill 是通用思考框架。
- 收敛后交接给其他 Agent 用 `cross-agent-handoff` 五件套。
- 收敛后自检用 `quality-gate`。
- 通道边界看 `a2a-channel-semantics`。

## 下一步

- Mode A 结束 → 拉实现计划，进 `quality-gate`。
- Mode B 结束 → **必须进入 Mode C** 收敛（待并行能力上线）。
- Mode C 完成后 → commit：`docs({scope}): {topic} 讨论收敛 + 追溯链`。
- 产出了新功能 → 走功能立项流程。
