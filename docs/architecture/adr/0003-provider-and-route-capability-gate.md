# ADR-0003：以能力门禁替代静默降级

- 状态：已采纳
- 日期：2026-07-10
- 决策范围：Provider、路由模式、Web 配置 UI、HTTP API

## 背景

`fanout` / `parallel` 曾在类型和 HTTP 输入中可选，但实际执行仍是单一串行 worklist；Gemini、OpenAI API 和 Custom provider 也会静默回退到 MockRunner。这会向用户、SDK 和审计记录承诺不存在的能力。

## 决策

1. 当前发布能力仅包括 `single`、`serial` 路由，以及 `mock`、`codex`、`claude` provider。
2. API 对 `fanout`、`parallel` 返回 `422 unsupported_route_mode`，并给出受支持模式列表。
3. 选择、保存或调度不受支持的 provider 返回 `422 unsupported_agent_provider`；RunnerRegistry 禁止回退到 MockRunner。
4. Web Provider 下拉框保留历史值的可见性，但将暂未支持的选项禁用并标注“暂不支持”。

## 后果

- 已持久化的旧 Invocation 仍可读取 `fanout` / `parallel`，但新调用不能创建这些模式。
- 接入新 Provider 或真实并行调度前，必须先实现 Runner/调度器、失败语义、集成测试和能力矩阵更新。

