import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentPromptParts } from "../src/agents/runners/CliPromptBuilder.js";
import type { AgentRunInput } from "../src/types.js";

test("buildAgentPromptParts injects handoffPayload only for target agent in user part", () => {
  const targetUser = buildAgentPromptParts(makeRunInput("banshee")).user;
  const nonTargetUser = buildAgentPromptParts(makeRunInput("shaxx")).user;

  assert.match(targetUser, /公开给用户看的自然交接文本。/);
  assert.match(targetUser, /本轮结构化交接上下文/);
  assert.match(targetUser, /What: 已完成风格分析。/);
  assert.match(targetUser, /Next Action: 起草文章初稿。/);
  assert.match(targetUser, /Evidence: message:message-1 \(用户目标\)/);

  assert.match(nonTargetUser, /公开给用户看的自然交接文本。/);
  assert.doesNotMatch(nonTargetUser, /本轮结构化交接上下文/);
  assert.doesNotMatch(nonTargetUser, /已完成风格分析。/);
  assert.doesNotMatch(nonTargetUser, /起草文章初稿。/);
});

test("buildAgentPromptParts puts identity/signature in system and state in user", () => {
  const parts = buildAgentPromptParts(makeRunInput("banshee"));
  assert.match(parts.system, /你是 Banshee-44/);
  assert.match(parts.system, /签名 \[Banshee-44\/mock🐾\]/);
  assert.match(parts.system, /可协作 Agent 名册/);
  assert.doesNotMatch(parts.system, /本轮结构化交接上下文/);
});

test("buildAgentPromptParts injects worklist guidance without exposing routeMode", () => {
  const user = buildAgentPromptParts({
    ...makeRunInput("banshee"),
    worklistAgents: ["ikora", "banshee", "shaxx"],
    worklistIndex: 1,
    routeMode: "fanout",
    remainingAgents: ["shaxx"],
    a2aEnabled: false,
  }).user;

  assert.doesNotMatch(user, /routeMode/);
  assert.doesNotMatch(user, /fanout/);
  assert.match(user, /当前 worklist: ikora -> banshee -> shaxx/);
  assert.match(user, /remainingAgents: shaxx/);
  assert.match(user, /不要重复 @ 当前 worklist 中等待执行的 Agent/);
  assert.match(user, /A2A 是否可继续: 否/);
});

function makeRunInput(agentId: "banshee" | "shaxx"): AgentRunInput {
  return {
    agent: {
      id: agentId,
      displayName: agentId === "banshee" ? "Banshee-44" : "Lord Shaxx",
      mentionHandles: [`@${agentId}`],
      provider: "mock",
      model: "mock",
      persona: { roleDescription: "测试角色", personality: "测试性格", strengths: [], restrictions: [] },
      enabled: true,
      createdAt: 1,
    },
    availableAgents: [
      {
        id: "ikora",
        displayName: "Ikora Rey",
        mentionHandles: ["@ikora"],
        provider: "mock",
        model: "mock",
        persona: { roleDescription: "负责深度调研与方案推演。", personality: "冷静缜密", strengths: ["调研"], restrictions: [] },
        enabled: true,
        createdAt: 1,
      },
      {
        id: "banshee",
        displayName: "Banshee-44",
        mentionHandles: ["@banshee"],
        provider: "mock",
        model: "mock",
        persona: { roleDescription: "负责代码实现与接口打磨。", personality: "务实专注", strengths: ["实现"], restrictions: [] },
        enabled: true,
        createdAt: 2,
      },
      {
        id: "shaxx",
        displayName: "Lord Shaxx",
        mentionHandles: ["@shaxx"],
        provider: "mock",
        model: "mock",
        persona: { roleDescription: "负责代码审查与风险评估。", personality: "尖锐直接", strengths: ["评审"], restrictions: [] },
        enabled: true,
        createdAt: 3,
      },
    ],
    threadId: "thread-1",
    invocationId: "invocation-1",
    callbackToken: "token-1",
    signal: new AbortController().signal,
    messages: [
      {
        id: "message-2",
        threadId: "thread-1",
        senderType: "agent",
        senderId: "ikora",
        content: "公开给用户看的自然交接文本。",
        mentions: ["banshee"],
        origin: "callback",
        deliveryStatus: "delivered",
        handoffPayload: {
          fromAgentId: "ikora",
          toAgentIds: ["banshee"],
          triggerMessageId: "message-1",
          what: "已完成风格分析。",
          why: "需要进入初稿阶段。",
          tradeoff: "保留完整五件套，但不展示给用户。",
          openQuestions: ["是否需要保留讽刺强度？"],
          nextAction: "起草文章初稿。",
          evidenceRefs: [{ kind: "message", ref: "message-1", note: "用户目标" }],
          riskLevel: "low",
          createdAt: 2,
        },
        createdAt: 2,
      },
    ],
  };
}
