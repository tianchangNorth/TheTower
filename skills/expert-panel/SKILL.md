---
name: expert-panel
description: >
  多 Agent 专家辩论团：在现有协作习惯上加一层轻量编排 + WHY 链标准 + 交付链。
  Use when: 技术趋势判断、竞品分析、行业事件分析、需要多视角决策支持、operator 说"帮我分析一下"。
  Not for: 单个 Agent 能搞定的问题、代码实现、bug fix、日常聊天。
  Output: WHY 链分析 + 收敛报告（共识/分歧/Tradeoffs/Open Questions/行动项）。
triggers:
  - "帮我分析一下"
  - "专家辩论"
  - "expert panel"
  - "技术参谋"
  - "竞品分析"
  - "行业分析"
  - "趋势判断"
  - "多 agent 分析"
---

# Expert Panel — 多 Agent 专家辩论团

**定位：编排层，不是独立流程。** 复用已有协作习惯，只添加三样东西：角色分配、WHY 链标准、交付链。

**核心原则：结论不值钱，论证过程才值钱。**

## 本 skill 只管三件事

1. **角色分配**：按视角分工，确保多元
2. **WHY 链标准**：每个结论必须有证据 → 推理 → 结论（本 skill 的独有增量）
3. **交付链**：收敛报告 + 沉淀检查（见下）

其余规则不重写，直接遵循已有 skill。协作交接用五件套（What/Why/Tradeoff/Open/Next），见 `cross-agent-handoff`。

## 角色分配

参与 Agent 按视角分工。最少 2 个，推荐 3 个。

| 角色 | 视角 | 职责 |
|------|------|------|
| **Analyst** | 架构/技术 | 技术深度、架构对比、可借鉴点 |
| **Assessor** | 风险/成本 | 成本结构、合规风险、踩坑预警 |
| **Strategist** | 生态/趋势 | 行业定位、大图景、用户/人才视角 |
| **Convergence Lead** | 收敛+交付 | 默认 Analyst 兼任，可指定 |

## 最小执行骨架

```
Dispatch → Independent → Synthesis → Contributor Check → Delivery
```

不是刚性 Phase，是自然节奏。有分歧就讨论，没有就是共识，不演。

### 1. Dispatch — 分发独立调研

Convergence Lead 用现有 `@agent-handle` mention 分发给各 Agent（在 `post_message` content 行首 @，或设 `targetAgents`）。

> ⚠️ TheTower 当前 worklist 是**串行**执行（见 `collaborative-thinking` Mode B 的 TODO 说明）。Dispatch 后各 Agent 会在 thread 里看到前序 Agent 的回复，**独立性不成立**。当前作为**降级模式**使用：接受串行轮询收集，在每个 Agent 的 dispatch 里明确要求"先给出你自己的独立判断，再看前文是否需要修正"，并在收敛时标注哪些观点受了前文影响。真并行待 `executeWorklist` 支持并发后启用。

**dispatch payload 只允许包含**：
- operator 的原始问题（一字不改）
- 该 Agent 的角色和视角
- 范围（调研边界）
- 输出格式要求（WHY 链四格）
- 原始材料（如有，如 operator 发的文件/链接）

**dispatch payload 禁止包含**：
- Lead 自己的判断、倾向、provisional conclusion
- Lead 的拆题方式或 framing（各 Agent 自己决定怎么拆）
- 其他 Agent 的摘要或分析

**Lead 自己的分析等其他 Agent 回来后再发，或和其他 Agent 同时出。**

### 2. Independent — 独立调研 + 独立分析

每个 Agent 独立完成调研和分析。

> **TODO：真并行 + 互不可见待 dispatch 能力上线。** 当前为串行降级模式（见上）。

**调研分两档**：

| 档位 | 何时用 | 方法 |
|------|--------|------|
| **Light**（默认） | 日常分析、快速判断 | WebSearch + 已有知识 + `read_file`/`list_files` |
| **Full** | 高 stakes / operator 说"调研" / 需要多源验证 | 启动深度调研完整流程（待 TheTower 有 `deep-research` skill 后） |

不确定用哪档 → 用 Light。Light 不够再升级。

**独立性保护规则**：
- 禁止互看：每个 Agent 先形成自己判断（串行降级下：先写独立判断，再标注看前文后的修正）
- 防锚定：有背景材料时，先形成自己想法再参考
- 标注不确定性：区分确信的结论和猜测

**分析输出格式 — WHY 链四格**：

每个核心判断必须有：
```
Evidence:   具体证据（案例/数据/事件 + 来源URL或引用）
Reasoning:  从证据到结论的逻辑链（为什么这个证据支持这个结论）
So what:    对我们意味着什么（行动含义）
Confidence: 确信 / 中等 / 猜测
```

**禁止**：
- 光给结论不给论证（"基于行业经验" 不是证据）
- Evidence 和 Reasoning 混在一起（拆开写）

### 3. Synthesis — 收敛

Convergence Lead 汇总所有 Agent 的分析，产出收敛报告。

收敛必须包含：
- 各方观点摘要
- 共识区
- **分歧区**（不抹平！各方理由都保留）
- Tradeoffs / 适用边界（结论在什么场景成立、什么场景不适用）
- Open Questions（待 operator 拍板）
- 行动项

### 4. Contributor Check — 原作者复核

各 Agent 确认收敛报告没有误读自己的观点。

**这步不能跳过**——收敛者可能误读原意。各 Agent 快速确认或修正即可。

### 5. Delivery — 交付

收敛完成后，Convergence Lead 一次性交付：

> **TODO：rich 交付链（洞察卡片 rich block / 语音总结 / DOCX/PDF 报告）依赖未实现的 MCP 工具（rich block、audio、generate_document）。** 当前交付物为**纯文本收敛报告**，写进 thread 公开 callback 的结论性总结 + 完整报告写进 stdout 或 `feature-specs/`。Rich 交付待对应 MCP 上线后补。

**a) 收敛报告**（纯文本，本轮交付物）——结构见下"报告结构"。

**b) 收敛沉淀检查**（来自 `collaborative-thinking` Mode C）：
```
1. 否决理由 → 记忆？[有/没有]
2. 踩坑教训 → 记忆？[有/没有]
3. 操作规则 → 指引？[有/没有]
```

## 报告结构

1. **命题与范围**：在讨论什么，不讨论什么
2. **核心判断**（每条四格）：Evidence / Reasoning / So what / Confidence
3. **证据矩阵**：各 Agent 调研发现汇总（来源 + 可靠度）
4. **推理链**：从证据到结论的逻辑链，含分歧点和各方理由
5. **Tradeoffs / 适用边界**：推荐在哪些场景成立、哪些不适用
6. **Premortem**：最可能翻车在哪 + 护栏
7. **行动建议**（分层：决策者 / 执行者）
8. **Open Questions**：待 operator 拍板
9. **独立贡献记录**：各 Agent 的独立判断摘要 + 独特洞察

## 输出通道（重要）

完整报告是过程产物，**不要原样贴进公开 callback**。遵循 `a2a-channel-semantics`：

- 完整报告写进 stdout（私有）或 `feature-specs/` 文件，或 `post_message` 设 `visibility="private"` + `handoffPayload` 给接手者。
- 公开 callback 只给结论性总结 + 行动项 + Open Questions，不贴路由元数据。

## 什么时候叠加其他 skill？

| 场景 | 用什么 |
|------|--------|
| 日常"帮我分析一下" | expert-panel 单独用（Light 调研档） |
| 高 stakes 决策、operator 说"调研" | expert-panel + 深度调研（待 `deep-research` skill） |
| 分析后需要沉淀 | expert-panel → `collaborative-thinking` Mode C |
| 需要和其他 Agent 交接分析结果 | expert-panel → `cross-agent-handoff` 五件套 |

## Common Mistakes

| 错误 | 修复 |
|------|------|
| Lead 在 dispatch 里夹带自己的判断/拆题 | dispatch 只含原始问题+角色+范围+格式，禁止注入 |
| 默认走 Full 深度调研 | 默认 Light，高 stakes 才升级 |
| Evidence 和 Reasoning 混在一起写 | 拆成两个独立字段 |
| "基于行业经验"当证据 | 必须指向具体案例/数据/事件+来源 |
| 收敛时抹平分歧 | 分歧必须保留+各方理由 |
| 报告结论像万能答案 | 加 Tradeoffs/Boundary，说清适用边界 |
| 跳过 Contributor Check | 收敛者可能误读，原作者必须确认 |
| 在串行 worklist 下声称独立并行 | 注明降级模式；要求各 Agent 先给独立判断再标修正 |
| 攒到最后才发 | 趁 callback token 新鲜立即发；token 过期则报告存本地 + 告诉 operator 下轮发 |

## 应急降级

| 风险 | 降级方案 |
|------|---------|
| 某 Agent 超时 | 不等，剩余 Agent 继续 |
| DOCX/rich 生成不可用 | 降级发纯文本报告（当前常态） |
| 争论不起来 | 那就是共识，不演 |
| callback token 过期 | 报告存本地 + 下轮对话发 |

## 下一步

- 行动项 → 功能立项流程
- 更深调研 → `deep-research`（待引入）
- 需要沉淀 → `collaborative-thinking` Mode C
- 收敛后自检 → `quality-gate`
