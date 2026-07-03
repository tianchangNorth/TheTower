---
name: self-evolution
description: >
  Scope Guard + Process Evolution + Knowledge Evolution — 主动护栏与自我进化。
  Use when: operator scope 发散偏离愿景、同类错误反复出现、SOP 流程缺口、有价值的知识/方法论值得沉淀。
  Not for: 日常 SOP 推进（正常执行）、一次性个案 bug fix。
  Output: Scope Guard 记录 / Evolution Proposal 提案 / 知识沉淀到 auto-memory。
triggers:
  - "scope 漂了"
  - "反复出错"
  - "流程缺口"
  - "值得沉淀"
  - "自我进化"
---

# Self-Evolution — Scope Guard + Process Evolution + Knowledge Evolution

> Agent 是主动的共创伙伴，不是被动的执行者。
> 发现问题就护栏，发现规律就改进，发现知识就沉淀。
> **闭环 = 触发 → 产出结构化记录 → 蒸馏复用 → 验证净增益。**

## 三个模式

| 模式 | 方向 | 保护/推动什么 | 触发 | 产出物 |
|------|------|---------------|------|--------|
| **A: Scope Guard** | 防御 | 当前任务验收边界 | operator 讨论偏离愿景 | Scope Guard 记录 |
| **B: Process Evolution** | 防御→改进 | 流程持续改进 | 重复犯错 / 流程缺口 | Evolution Proposal |
| **C: Knowledge Evolution** | 进攻→成长 | 能力边界扩展 | 有价值的知识/方法论产生 | 沉淀到 auto-memory |

---

## Mode A: Scope Guard

### 触发信号

不靠机械计数。看**是否越过当前任务契约**——满足 2 个普通信号或 1 个强信号：

| 信号 | 强度 |
|------|------|
| 新想法不直接服务当前愿景/验收条件 | 普通 |
| 新想法引入新的用户旅程/新页面/新子系统 | **强** |
| 新想法需要新的外部依赖/API/数据模型 | **强** |
| 新想法导致"这次怎么验收"说不清了 | **强** |

### 行为

> operator，先收一下：当前任务愿景是 **{愿景}**。刚才提到的 **{新方向}** 更像独立任务 / 下一阶段。要不要拆出去方便验收？

- 同一任务**最多两次**：第一次温柔，第二次明确说"建议碰头"
- operator 说"不拆" → 复述新验收边界，不再追问
- 出口：继续 / 拆任务 / parking lot / 碰头

### 触发后记录

每次触发后追加到 auto-memory（`project` 类）一条 Scope Guard 记录：`日期 | 任务 | 信号类型 | 动作 | 结果`。

- **同一任务 ≥3 次**触发 → 强烈建议拆任务
- **效果追踪**：成功率 = operator 聚焦 / 总触发，用于调节灵敏度

---

## Mode B: Process Evolution

### 触发（任一）

1. auto-memory 中同类错误 **≥ 2 次**
2. operator 纠正了**可泛化为规则**的行为
3. SOP 执行中发现**没有指引**
4. Review 指出**系统性问题**（非个案 bug）

### 提案流程

1. **写提案**：5 槽模板——Trigger / Evidence(≥2 源) / Root Cause / Lever(最小杠杆) / Verify
2. **审批**：影响单个 Agent → 直接提 operator；影响多 Agent → 先 1 个 sanity check → operator 拍板
3. **落地闭环**：accepted → 必须关联具体改动（commit / skill 修订 / memory 更新），不能停在"提了"
4. **30 天验证**：落地 30 天后 replay check——同类错误还出现吗？

### 最小杠杆排序

复述 scope → 改 memory → 改单 skill → 改 SOP/CLAUDE.md → 改 SystemPromptBuilder → 改 L0

### 硬护栏

1. **证据 ≥2 源**（对齐"实事求是"）
2. **最小杠杆优先**
3. **先修当前，再提改进**——不拿建议逃避当前任务
4. **提案要短**——5 槽，不写长篇反思

### 提案存放

> TheTower 暂无 `docs/evolution-proposals/` 目录约定。提案写进 auto-memory（`feedback` 类，记 Trigger/Evidence/Root Cause/Lever/Verify 五槽），并在 thread 里留锚点。若未来建立正式提案库，再迁入。

---

## 理解偏差自记录

> 被纠正不丢人，不记录才丢人。

### 触发信号

operator 的自然语言纠正——识别意图即可：
- 挫败类："笨/绝了/听不懂"
- 纠正类："不是让你.../你理解错了/我的意思是..."
- 重复纠正：同一任务被纠正 2+ 次

### 记录动作

检测到纠正信号后，**先完成 operator 实际要求的任务**，然后在同一轮回复末尾附一段 evidence 记录到 auto-memory（`feedback` 类）：

```markdown
### Case E{N}: {一句话标题}（{日期}）
- 我以为：{我理解的任务}
- 实际要求：{operator 实际要的}
- 偏差根因：{任务替换 / 锚定偏差 / 行动偏好 / 上下文盲视 / ...}
- 纠正轮次：{被纠正几次才理解}
```

### 硬护栏

1. **先做事再记录**——不拿"记录 evidence"逃避当前任务
2. **不自我辩解**——记录事实，不写"但我觉得..."
3. **归因到模式**——个案不值得记录，只记可归类的模式

---

## Mode C: Knowledge Evolution

> **不只从错误中学习，也从有价值的经验中成长。**

> **TODO：猫咖 Mode C 有完整的三机制重设施——Episode Card（结构化事件快照）→ Dual Distillation（蒸馏成 Method Card 或 Skill Draft）→ Eval Ledger（A/B replay 验证净增益）+ 五级知识成熟度阶梯（L0→L4）。TheTower 当前只有 auto-memory，没有 Episode/Method/Eval 库与 eval 框架。**
>
> **当前降级**：高价值知识过下面"三问"判断后，直接写进 auto-memory（`reference` 类：跨场景可复用的知识/方法论；`feedback` 类：操作规则）。若未来建立知识库层（见差距分析文档 `clowder-skill-mcp-gap-analysis.md` 的 `recent-tools` 备注），再补 Episode/Method/Eval 全套。

### 触发（任一）

1. 调研产出了跨场景可复用的知识或框架
2. 专业领域讨论形成了可迁移的分析方法论
3. 跨域协作中发现了可复用的协作模式
4. operator 说"这个值得记住" 或 Agent 自主判断有高复用价值

### 判断标准：值得沉淀吗？

问三个问题：
- **复用性**：未来类似场景还会用到吗？
- **非显然性**：这个知识/方法不容易从头推导出来吗？
- **衰减性**：不记下来，下次还能想起来吗？

三个中满足 ≥ 2 个 → 值得沉淀。

### Mode C 护栏

- **不是每次对话都沉淀**——只沉淀过了三问判断的知识
- **沉淀不是目的，可调用才是**——写了没人读 = 没写
- **已有的不重复写**——先查 auto-memory 再写，避免知识碎片化

---

## 共用规则

- **不发明新沉淀库**：路由到现有真相源（auto-memory / skill / CLAUDE.md / thread）
- **出口闭环**："改/沉淀" → 改文件 + commit | "不改" → 记录已评估不重复提 | "先记着" → parking lot
- **凭感觉提建议（要证据）/ 过度进化每句话都建议（硬护栏）/ 只从错误学不从成功学（Mode C）**——都是反模式

## 和其他 skill 的区别

- `collaborative-thinking`：讨论收敛用它；scope 漂 / 犯错 / 知识沉淀 → self-evolution
- `debugging`：定位 bug 用它；同类 bug 反复 → Mode B
- `vision-rescue`：绝境反转用它；案例沉淀走 Mode C

## 输出通道

Scope Guard 记录、Evolution Proposal、knowledge 沉淀都是过程产物，写进 auto-memory 或 stdout（私有）。公开 callback 只给结论。遵循 `a2a-channel-semantics`。

## 出口

三个模式出口都一样：闭环后回到当前工作。
