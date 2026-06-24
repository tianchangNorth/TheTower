import { AgentRegistry } from "./agents/AgentRegistry.js";
import { RunnerRegistry } from "./agents/RunnerRegistry.js";
import { db } from "./db/database.js";
import { initSchema } from "./db/schema.js";
import { EventBus } from "./events/EventBus.js";
import { WorklistRegistry } from "./routing/WorklistRegistry.js";
import { AgentStore } from "./stores/AgentStore.js";
import { CallbackTokenStore } from "./stores/CallbackTokenStore.js";
import { InvocationStore } from "./stores/InvocationStore.js";
import { MessageStore } from "./stores/MessageStore.js";
import { ThreadStore } from "./stores/ThreadStore.js";
import { CommunicationService } from "./services/CommunicationService.js";
import type { Agent } from "./types.js";

export function createAppContext() {
  initSchema(db);

  const agentStore = new AgentStore(db);
  seedAgents(agentStore);

  const agentRegistry = new AgentRegistry();
  agentRegistry.replaceAll(agentStore.list());

  const threadStore = new ThreadStore(db);
  const messageStore = new MessageStore(db);
  const invocationStore = new InvocationStore(db);
  const callbackTokenStore = new CallbackTokenStore(db);
  const worklists = new WorklistRegistry();
  const events = new EventBus();
  const runnerRegistry = new RunnerRegistry();

  const communication = new CommunicationService({
    agentRegistry,
    runnerRegistry,
    threadStore,
    messageStore,
    invocationStore,
    callbackTokenStore,
    worklists,
    events,
  });

  return {
    stores: {
      agentStore,
      threadStore,
      messageStore,
      invocationStore,
      callbackTokenStore,
    },
    agentRegistry,
    communication,
    events,
  };
}

function seedAgents(agentStore: AgentStore): void {
  if (agentStore.list().length > 0) return;
  const now = Date.now();
  const defaults: Agent[] = [
    {
      id: "agent-a",
      displayName: "架构师",
      mentionHandles: ["@agent-a", "@arch"],
      provider: "mock",
      model: "mock-architect",
      rolePrompt: "你负责系统架构设计。",
      enabled: true,
      createdAt: now,
    },
    {
      id: "agent-b",
      displayName: "Reviewer",
      mentionHandles: ["@agent-b", "@reviewer"],
      provider: "mock",
      model: "mock-reviewer",
      rolePrompt: "你负责审查、安全和测试。",
      enabled: true,
      createdAt: now + 1,
    },
  ];

  for (const agent of defaults) agentStore.upsert(agent);
}
