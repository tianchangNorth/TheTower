import { AgentRegistry } from "./agents/AgentRegistry.js";
import { RunnerRegistry } from "./agents/RunnerRegistry.js";
import { bootstrapAgentCatalog, loadAgentCatalog, resolveProjectRoot } from "./config/AgentConfigLoader.js";
import { ContextBuilder } from "./context/ContextBuilder.js";
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
import { createDefaultSkillResolver } from "./skills/SkillResolver.js";

export function createAppContext() {
  initSchema(db);

  const agentStore = new AgentStore(db);
  const projectRoot = resolveProjectRoot();
  bootstrapAgentCatalog(projectRoot);
  syncAgentStoreFromCatalog(agentStore, projectRoot);

  const agentRegistry = new AgentRegistry();
  agentRegistry.replaceAll(agentStore.list());

  const threadStore = new ThreadStore(db);
  const messageStore = new MessageStore(db);
  const invocationStore = new InvocationStore(db);
  const callbackTokenStore = new CallbackTokenStore(db);
  const worklists = new WorklistRegistry();
  const events = new EventBus();
  const runnerRegistry = new RunnerRegistry();
  const skillResolver = createDefaultSkillResolver(projectRoot);
  const contextBuilder = new ContextBuilder({ messageStore });

  const communication = new CommunicationService({
    agentRegistry,
    runnerRegistry,
    threadStore,
    messageStore,
    invocationStore,
    callbackTokenStore,
    worklists,
    events,
    skillResolver,
    contextBuilder,
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
    projectRoot,
    communication,
    events,
  };
}

function syncAgentStoreFromCatalog(agentStore: AgentStore, projectRoot: string): void {
  const catalog = loadAgentCatalog(projectRoot);
  agentStore.replaceAll(catalog.agents);
}
