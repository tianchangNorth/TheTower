---
name: writing-plans
description: >
  将 spec/需求拆分为可执行的分步实施计划。
  Use when: 有 spec 或需求，准备动手前需要拆分步骤。
  Not for: trivial 改动（≤5 行）、已有详细计划。
  Output: 分步实施计划（含 TDD 步骤和检查点）。
triggers:
  - "写计划"
  - "implementation plan"
  - "拆分步骤"
---

# Writing Plans

将 spec/需求拆分为分步实施计划。写清楚每步改哪些文件、代码、测试、怎么验证。DRY. YAGNI. TDD. Frequent commits.

## 开工前 Recall

写计划前先搜相关历史——查 auto-memory（`feedback` / `project` 类）和 `docs/` 下既有 spec/讨论，避免重复造轮子。

> **TODO**：TheTower 暂无 `search_evidence` 类语义检索 MCP。当前靠 auto-memory recall + `read_file`/`list_files` 手工查。语义检索待记忆/知识库 MCP 上线后接入。

**Save plans to:** `feature-specs/YYYY-MM-DD-<feature-name>.md`

## Straight-Line Check (A→B, No Detour)

**拆步骤前先做这四件：**

1. **Pin the finish line**：一句话 B 定义 + 验收标准 + "我们不建什么"
2. **Define terminal schema**：最终形态的接口 / 类型 / 数据结构——步骤围绕它建，不是建了再重写
3. **每步过三问：**
   - 这步的产出会原样留在最终系统吗（只扩展不重写）？→ 是 = 在线上；否 = 绕路
   - 这步之后能 demo/测试什么？（无可验证证据 = 绕路）
   - 删掉这步，到达 B 会多付什么具体代价？（说不清 = 绕路）
4. **纯探索 = 显式 Spike**（限时 + 产出是决策/结论，不是交付物）

**步骤是内部实现节奏，不是交付批次。** 交付给用户的是匹配完整 spec 的成品，不是某步的产出。不要把中间步骤当"验收点"暴露给用户。

## Stateful Object Gate

Plan 涉及**有生命周期的状态对象**（thread 标记 / invocation / session / 持久 config / cache / 索引 / 注册表）时，「功能描述 + 幂等测试点」**不够**——那等于把状态机的边留给 reviewer 逐轮补。

**Census 先行**：gate 第一步是**普查**——列出 plan 涉及的全部有生命周期对象，再逐个三件套。注意"复用现有 API"场景下的**新消费侧状态**（轮询循环、发送闸门、到达判定器都是状态机）。漏报对象 = gate 形同虚设。

**三件套，缺一 = plan 不完整，不准发给实现者：**

1. **状态×事件转移表** — 含「唯一 lifecycle owner 是谁」+「旁路 API（generic restore / delete / list）禁止哪些操作」
2. **不变量清单** — INV-N 编号，每条标注可测方式，test matrix 逐条对应
3. **对抗场景** — crash window / 并发双写 / 恢复路径 / 旁路 API 误用，每个场景一条测试

**派生值规则**：能用纯投影（pure selector，零存储）表达的状态，禁止落独立存储——无同步即无失同步。

## Bite-Sized Task Granularity

**每步一个动作（2-5 分钟）：**
- "写失败的测试" - 一步
- "跑测试确认失败" - 一步
- "写最小实现让测试通过" - 一步
- "跑测试确认通过" - 一步
- "Commit" - 一步

## Plan Document Header

**每个 plan 必须以此 header 开头**（按 TheTower 适配，无对应字段填 none）：

```markdown
# [Feature Name] Implementation Plan

**Goal:** [一句话——必须匹配 spec 的 goal]
**Acceptance Criteria:** [从 spec 逐条抄来，plan 必须覆盖全部 AC]
**Architecture:** [2-3 句方法说明]
**Tech Stack:** [关键依赖/库]
**前端验证:** [涉及前端？标注 Yes——reviewer 必须实测]
**Stateful objects:** [涉及有生命周期对象？列出 → 触发 Stateful Object Gate；无 → none]

---
```

## Task Structure

```markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts:123-145`
- Test: `packages/.../test/exact/path.test.ts`

**Step 1: 写失败测试**

```ts
test("specific behavior", () => {
  const result = fn(input);
  assert.equal(result, expected);
});
```

**Step 2: 跑测试确认失败**
Run: `pnpm --filter @the-tower/api test`
Expected: FAIL

**Step 3: 写最小实现**

**Step 4: 跑测试确认通过**
Expected: PASS

**Step 5: Commit**
```bash
git add packages/.../file.ts packages/.../test.test.ts
git commit -m "feat: add specific behavior"
```
```

## Open Questions in Plans

计划中的 Open Question 必须分类：
- **技术 OQ**：实现过程中自行解决
- **价值 OQ**：需要 operator 判断 → 附 Decision Packet（TL;DR + 回滚成本 + 真正需要判断的价值问题）

先判断可逆性：回滚成本低的不升级 operator，自决。

## 输出通道

完整 plan 是过程产物，**不要原样贴进公开 callback**。遵循 `a2a-channel-semantics`：完整 plan 写进 `feature-specs/` 文件或 stdout（私有）；公开 callback 只给一句"计划已写好，要点是 X"。

## Remember
- 精确文件路径
- plan 里写完整代码（不是"加个校验"）
- 精确命令 + 预期输出
- DRY, YAGNI, TDD, frequent commits

## 和其他 skill 的关系

- 计划前需要发散思考 → `collaborative-thinking` Mode A
- 计划写完 → `worktree`（隔离开发环境）→ `tdd`（开始实现）
- 提交前自检 → `quality-gate`

## 下一步

计划写完并提交 → 直接加载 `worktree` → `tdd`。
