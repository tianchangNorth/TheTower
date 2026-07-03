---
name: worktree
description: >
  创建 Git worktree 隔离开发环境。
  Use when: 开始任何非 trivial 的代码修改、新功能开发、bug fix。
  Not for: 纯文档修改（≤5 行）、不涉及代码/脚本/API/执行面的讨论。
  Output: 隔离的 worktree + 基线测试通过。
triggers:
  - "开始开发"
  - "新 worktree"
  - "开 worktree"
---

# Worktree

开始任何非 trivial 的功能开发前，拉 worktree 隔离，**不要直接在 main 上改代码**。

Skill / 配置改动如果触及 API route、script、CLI command、第一方执行面，即使 ≤5 行，也不按"纯文档免验证"处理：至少 commit 前跑 `pnpm -r typecheck`；非 trivial 行为改动仍应开 worktree。

> 本 skill 是猫咖 worktree skill 的精简移植。猫咖版包含 Redis 端口隔离 / sidecar 开关 / runtime 生产环境守卫等大量专有设施，TheTower 不适用，已剔除。TheTower 若引入多实例并发开发（端口隔离等），再补。

## 开工前 Recall

拉 worktree 前先查 auto-memory + `docs/` 下既有 spec/讨论，避免重复造轮子。

## 目录位置

**先查项目约定**：`CLAUDE.md` / `AGENTS.md` 有没有指定 worktree 位置 → 有就用 → 没有再问 operator。

通用约定（无指定时）：

```bash
git worktree add ../<project>-{feature-name} -b feat/{feature-name}
```

- 🔴 **禁止在项目内部创建** worktree（不要用 `.worktrees/` 子目录污染主仓）
- 🔴 **禁止删/清理任何 `*-runtime` 命名的 worktree**（那可能是生产/常驻环境）
- worktree 放在主仓**同级目录**

## 创建前：Main 同步检查

开 worktree 前必须确认 main 与 `origin/main` 完全同步（双向）。不同步 = 信息不对称。

```bash
# 1. 检查是否有未提交变更
git status --porcelain | head -5
# 有输出 → 先 commit/stash 再继续

# 2. 检查 main 与 remote 双向同步
git fetch origin main --quiet
AHEAD=$(git rev-list --count origin/main..main)
BEHIND=$(git rev-list --count main..origin/main)
echo "ahead=$AHEAD behind=$BEHIND"
# ahead > 0 → git push origin main
# behind > 0 → git pull origin main
# 两者都 = 0 → 可以继续
```

不同步时：先处理到 `ahead=0 behind=0` 再创建 worktree。

## 创建步骤

```bash
# 1. 创建 worktree
git worktree add ../<project>-{feature-name} -b feat/{feature-name}
cd ../<project>-{feature-name}

# 2. 安装依赖（必须清除 NODE_ENV，否则跳过 devDeps 导致 build 失败）
env -u NODE_ENV pnpm install

# 3. 验证基线测试通过
pnpm -r typecheck
pnpm --filter @the-tower/api test
# 失败了先报告再问是否继续，不要硬上
```

## CWD / Worktree / URL 护栏

"我以为在测 dev，实际打到了生产" 这类事故，根因是 **CWD / worktree / 目标 URL 三者脱钩**。

动手前先明确两件事：

1. **我在哪个仓/哪个 worktree？**
   ```bash
   pwd
   git branch --show-current
   ```
2. **我要打哪个 URL/进程？**
   - 验证当前 worktree 的未合入改动 → 用该 worktree 自己的实例/端口
   - 不要拿常驻/生产环境的端口冒充开发环境

一句话铁律：**未合入改动的验证，不得拿常驻环境冒充开发环境。**

## 合入后清理

分支合入 main 后**当场清理**，不要留到下次：

```bash
git worktree remove ../<project>-{feature-name}
git branch -d feat/{feature-name}
git worktree prune
```

检查积压：

```bash
git worktree list             # 列出所有 worktree
git branch --merged main      # 哪些分支已合入
```

## 安全核查

创建前：
- [ ] Main 双向同步（`ahead=0 behind=0`）
- [ ] worktree 放在主仓同级（不在项目内部）
- [ ] 不是 `*-runtime` 命名
- [ ] 基线测试通过（失败先报告）
- [ ] 验证目标已明确，不拿常驻环境冒充开发环境

清理前：
- [ ] 分支已合入 main（`git branch --merged main`）
- [ ] 不是 `*-runtime`（永远不删）

## 输出通道

创建/清理的命令输出是过程产物，写进 stdout（私有）。公开 callback 只给"worktree 已就绪/已清理"一句结论。遵循 `a2a-channel-semantics`。

## 和其他 skill 的关系

- 开发流程：`writing-plans`（在 main 上写计划）→ `worktree`（隔离）→ `tdd`（实现）
- 提交前自检 → `quality-gate`

## 下一步

→ 直接加载 `tdd`（在 worktree 里开始实现）。
