# Phase 5：A2A 协作治理与 UI 完成态

## 目标

在底层上下文和 callback 能力稳定后，完成 A2A 协作体验和治理规则。

Phase 5 关注用户实际看到的协作过程是否清晰、可审计、可调试。

## 最终 A2A 信息传递模式

```text
Message.content
  展示给用户的内容。

Message.handoffPayload
  目标 Agent 接球用的结构化上下文。

Message.visibility
  控制哪些 Agent 可见。

Message.origin
  区分 final / stream / callback / tool / briefing。

ContextBuilder
  构造 Agent 可见上下文。

Skills
  约束 Agent 如何交接、接球、review、收尾。
```

## A2A 路由规则

保留当前核心规则：

- 行首 mention 触发 A2A 路由。
- inline mention 只作为显示，不触发路由。
- `targetAgents` 可以显式补充路由目标。
- “收到”“已完成”“谢谢”这类确认不应继续 @ 下一个 Agent。
- final answer 不应伪造其他 Agent 发言。

但最终不应要求“每个目标单独一行”。参考 Cat Cafe，TheTower 应支持 line-start mention cluster：某一行从 `@handle` 开始后，可以连续写多个目标，例如：

```text
请大家依次做一个简短自我介绍。

@ikora @banshee @shaxx @ada
```

这条消息的正文仍然自然，最后一行是纯路由行。路由解析只消费最后这行的目标，不要求协调者写四句重复指令。

同时，工具和内部 API 仍应支持结构化 `targetAgents`：

```text
Message.content
  用户应该看到的内容，可以包含一行纯路由 mention cluster。

Message.mentions / targetAgents
  系统用于唤醒 Agent 的结构化路由目标。
```

因此，多 Agent 场景有两种合法表达：

- 文本表达：最后一行 `@a @b @c`。
- 工具表达：`targetAgents: ["a", "b", "c"]`。

不要用多行重复句子表达同一个 fanout 任务。

## A2A 路由模式

建议新增路由模式：

```ts
export type A2ARouteMode =
  | "single"   // 单个 Agent 处理
  | "serial"   // 串行接力，上一位完成后传下一位
  | "fanout"   // 多个 Agent 各自执行，不要求彼此接力
  | "parallel"; // 多个 Agent 并行产出，默认不从输出中继续解析 A2A
```

### single

用户或 Agent 明确交给一个目标：

```text
@ikora 请 review 这个设计。
```

结构化：

```ts
targetAgents: ["ikora"]
routeMode: "single"
```

### serial

需要接力，每一棒只唤醒下一棒：

```text
zavala -> ikora -> banshee -> shaxx -> ada -> zavala
```

规则：

- 协调者只指定第一棒和顺序。
- 当前 Agent 完成自己部分后，才把球交给下一棒。
- 接球 Agent 可以继续 @ 下一棒，因为这是串行任务本身的一部分。

### fanout

一个协调者同时请多个 Agent 各自行动，例如“大家都自我介绍”。

用户可见内容：

```text
请大家依次做一个简短自我介绍。

@ikora @banshee @shaxx @ada
```

结构化：

```ts
targetAgents: ["ikora", "banshee", "shaxx", "ada"]
routeMode: "fanout"
```

规则：

- 协调者不需要在 `content` 里写四行重复的 `@handle`。
- 如果使用文本路由，推荐把所有目标放在最后一行纯路由列表中：`@ikora @banshee @shaxx @ada`。
- 每个被唤醒 Agent 只完成自己的任务。
- 被 fanout 唤醒的 Agent 不应再 @ 其他已在原始 worklist 里的 Agent。
- worklist 已包含的目标由系统继续执行，不需要前一位 Agent 人工接力。

这正是“大家自我介绍”场景应该使用的模式。

### parallel

多个 Agent 并行提供观点，通常用于 brainstorming / ideate。

规则：

- Agent 输出中的行首 @ 默认不继续触发 A2A。
- 避免并行 Agent 互相拉起，造成重复任务或循环。
- 如需后续汇总，由协调者或系统指定 summary Agent。

## Fanout 场景的当前问题

当前行为：

```text
zavala:
@ikora 请自我介绍。
@banshee 请自我介绍。
@shaxx 请自我介绍。
@ada 请自我介绍。

ikora:
...自我介绍...
@banshee 请接力自我介绍。
```

问题：

1. Zavala 必须写多行行首 @，用户看到重复路由文本。
2. Ikora 不知道 Banshee 已经在 worklist 中，于是继续 @banshee。
3. 系统虽然可能 dedupe worklist，但 UI timeline 仍然出现多余交接。

优化后：

```text
zavala:
请大家依次做一个简短自我介绍。

@ikora @banshee @shaxx @ada

系统路由:
targetAgents = ["ikora", "banshee", "shaxx", "ada"]
routeMode = "fanout"

ikora:
我是 Ikora Rey...

banshee:
我是 Banshee-44...
```

Agent prompt 中应明确：

```text
当前 routeMode: fanout
当前 worklist: ikora -> banshee -> shaxx -> ada
你只需要完成自己的部分。
不要 @ 已经在当前 worklist 中等待执行的 Agent。
```

## Handoff 展示模式

用户默认看到：

```text
ikora
@banshee 请基于风格指南起草文章初稿。
```

目标 Agent 收到：

```text
来自 ikora 的交接：

What:
...

Why:
...

Tradeoff:
...

Open Questions:
...

Next Action:
...
```

UI 可以提供“展开交接详情”，但默认 timeline 不强制展示五件套。

## UI 完成态

Thread 页面应支持：

1. Message badge：
   - public
   - private
   - callback
   - agent_final
   - agent_stream
   - tool
   - briefing
2. Thread mode：
   - debug
   - play
3. private message：
   - 默认折叠或标记。
   - 显示可见 Agent。
   - 用户可以展开审计。
   - 用户可以 reveal。
4. handoffPayload：
   - 默认不显示完整五件套。
   - 调试模式下可展开。
5. Agent 面板：
   - 当前启用 skills。
   - 当前 provider。
   - 当前运行状态。
6. Invocation 面板：
   - started / running / done / failed。
   - CLI 实时事件。
   - tool event。
   - callback write。

## 协作治理规则

Skills 应约束：

- 交接必须有明确 `Next Action`。
- 接球 Agent 先确认任务边界，再执行。
- review 必须区分 blocking / non-blocking。
- 最后一个 Agent 必须进行 quality gate。
- Agent 不应将内部五件套原样当作用户最终内容。

## 主要文件

- `packages/api/src/services/CommunicationService.ts`
- `packages/api/src/routing/**`
- `packages/api/src/skills/**`
- `packages/web/src/**`
- `skills/**`

## 开发任务

1. 完成 A2A 路由回归测试。
2. 完成 ping-pong 防护回归测试。
3. 增加 `routeMode`：`single | serial | fanout | parallel`。
4. 支持结构化 `targetAgents` 路由，不要求所有目标都写进可见 `content`。
5. 支持 Cat Cafe 式 line-start mention cluster：最后一行 `@a @b @c`。
6. fanout / parallel 模式下，Agent 输出默认不继续解析 A2A，除非显式声明允许。
7. prompt 中注入当前 routeMode、worklist、remainingAgents。
8. skills 增加规则：不要 @ 已经在当前 worklist 中等待执行的 Agent。
9. UI 增加 origin / visibility badge。
10. UI 增加 handoffPayload 展开能力。
11. UI 增加 private 审计 / reveal。
12. UI 增加 debug / play 切换。
13. UI 增加 invocation event 展示。
14. 更新 skills，减少用户可见五件套污染。
15. 端到端验证多 Agent 接力。

## 验收场景

### 场景 1：公开接力写诗

```text
user -> zavala -> ikora -> banshee -> shaxx -> ada -> zavala
```

验收：

- 每个 Agent 只写自己该写的内容。
- 不出现无意义 ping-pong。
- 最后 Zavala 汇总完整结果。

### 场景 1.5：fanout 自我介绍

```text
user:
都自我介绍下

zavala:
请大家依次做一个简短自我介绍。

@ikora @banshee @shaxx @ada

system:
targetAgents = ["ikora", "banshee", "shaxx", "ada"]
routeMode = "fanout"
```

验收：

- Zavala 不需要在可见文本中重复四行行首 @。
- Zavala 可以用最后一行 `@ikora @banshee @shaxx @ada` 表达多目标路由。
- Ikora 自我介绍后不再 @ Banshee。
- Banshee / Shaxx / Ada 仍会按 worklist 执行。
- Agent 不会重复唤醒已经在 worklist 中的目标。

### 场景 2：隐藏 handoffPayload

验收：

- 用户默认 timeline 不展示完整五件套。
- 目标 Agent prompt 中包含完整五件套。
- 非目标 Agent 不看到 payload。

### 场景 3：private callback

验收：

- Agent A callback private 给 Agent B。
- Agent B 能通过 thread-context 看到。
- Agent C 不能看到。
- 用户能审计。

### 场景 4：stream 隔离

验收：

- debug 模式可以看到更多运行过程。
- play 模式下 Agent 看不到其他 Agent 的 `agent_stream`。
- CLI token delta 不触发路由。

## 不做事项

- 不做狼人杀 GameRuntime。
- 不做长期记忆。
- 不做 Redis 队列。
- 不做 skill marketplace。
