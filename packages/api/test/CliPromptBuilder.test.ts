import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentPrompt } from "../src/agents/runners/CliPromptBuilder.js";
import type { AgentRunInput } from "../src/types.js";

test("buildAgentPrompt injects handoffPayload only for target agent", () => {
  const targetPrompt = buildAgentPrompt(makeRunInput("banshee"));
  const nonTargetPrompt = buildAgentPrompt(makeRunInput("shaxx"));

  assert.match(targetPrompt, /公开给用户看的自然交接文本。/);
  assert.match(targetPrompt, /本轮结构化交接上下文/);
  assert.match(targetPrompt, /What: 已完成风格分析。/);
  assert.match(targetPrompt, /Next Action: 起草文章初稿。/);
  assert.match(targetPrompt, /Evidence: message:message-1 \(用户目标\)/);

  assert.match(nonTargetPrompt, /公开给用户看的自然交接文本。/);
  assert.doesNotMatch(nonTargetPrompt, /本轮结构化交接上下文/);
  assert.doesNotMatch(nonTargetPrompt, /已完成风格分析。/);
  assert.doesNotMatch(nonTargetPrompt, /起草文章初稿。/);
});

test("buildAgentPrompt injects routeMode and remaining worklist guidance", () => {
  const prompt = buildAgentPrompt({
    ...makeRunInput("banshee"),
    worklistAgents: ["ikora", "banshee", "shaxx"],
    worklistIndex: 1,
    routeMode: "fanout",
    remainingAgents: ["shaxx"],
    a2aEnabled: false,
  });

  assert.match(prompt, /当前 routeMode: fanout/);
  assert.match(prompt, /当前 worklist: ikora -> banshee -> shaxx/);
  assert.match(prompt, /remainingAgents: shaxx/);
  assert.match(prompt, /不要 @ 当前 worklist 中等待执行的 Agent/);
  assert.match(prompt, /A2A 是否可继续: 否/);
});

function makeRunInput(agentId: "banshee" | "shaxx"): AgentRunInput {
  return {
    agent: {
      id: agentId,
      displayName: agentId === "banshee" ? "Banshee-44" : "Lord Shaxx",
      mentionHandles: [`@${agentId}`],
      provider: "mock",
      model: "mock",
      rolePrompt: "你是测试 Agent。",
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
        rolePrompt: "负责深度分析。",
        enabled: true,
        createdAt: 1,
      },
      {
        id: "banshee",
        displayName: "Banshee-44",
        mentionHandles: ["@banshee"],
        provider: "mock",
        model: "mock",
        rolePrompt: "负责实现。",
        enabled: true,
        createdAt: 2,
      },
      {
        id: "shaxx",
        displayName: "Lord Shaxx",
        mentionHandles: ["@shaxx"],
        provider: "mock",
        model: "mock",
        rolePrompt: "负责评审。",
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
        origin: "agent_final",
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
