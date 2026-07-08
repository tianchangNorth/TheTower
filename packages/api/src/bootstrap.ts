import { AgentRegistry } from "./agents/AgentRegistry.js";
import { AgentRuntimeStatusRegistry } from "./agents/AgentRuntimeStatusRegistry.js";
import { RunnerRegistry } from "./agents/RunnerRegistry.js";
import { bootstrapAgentCatalog, loadAgentCatalog, resolveProjectRoot } from "./config/AgentConfigLoader.js";
import { ContextBuilder } from "./context/ContextBuilder.js";
import { db } from "./db/database.js";
import { initSchema } from "./db/schema.js";
import { EventBus } from "./events/EventBus.js";
import { WorklistRegistry } from "./routing/WorklistRegistry.js";
import { AgentStore } from "./stores/AgentStore.js";
import { CallbackTokenStore } from "./stores/CallbackTokenStore.js";
import { AgentRuntimeStatusStore } from "./stores/AgentRuntimeStatusStore.js";
import { InvocationStore } from "./stores/InvocationStore.js";
import { MessageStore } from "./stores/MessageStore.js";
import { TaskStore } from "./stores/TaskStore.js";
import { ThreadStore } from "./stores/ThreadStore.js";
import { WorkspaceStore } from "./stores/WorkspaceStore.js";
import { CommunicationService } from "./services/CommunicationService.js";
import { WorkspaceFileService } from "./services/WorkspaceFileService.js";
import { createDefaultSkillResolver } from "./skills/SkillResolver.js";

export function createAppContext() {
  initSchema(db);

  const agentStore = new AgentStore(db);
  const projectRoot = resolveProjectRoot();
  bootstrapAgentCatalog(projectRoot);
  syncAgentStoreFromCatalog(agentStore, projectRoot);

  const agentRegistry = new AgentRegistry();
  agentRegistry.replaceAll(agentStore.list());
  const runtimeStatusStore = new AgentRuntimeStatusStore(db);
  const runtimeStatuses = new AgentRuntimeStatusRegistry(runtimeStatusStore);

  const threadStore = new ThreadStore(db);
  const messageStore = new MessageStore(db);
  const invocationStore = new InvocationStore(db);
  const callbackTokenStore = new CallbackTokenStore(db);
  const workspaceStore = new WorkspaceStore(db);
  const taskStore = new TaskStore(db);
  const worklists = new WorklistRegistry();
  const events = new EventBus();
  const runnerRegistry = new RunnerRegistry();
  const skillResolver = createDefaultSkillResolver(projectRoot);
  const skillRegistry = skillResolver.getRegistry();
  const contextBuilder = new ContextBuilder({ messageStore });

  const communication = new CommunicationService({
    agentRegistry,
    runnerRegistry,
    threadStore,
    messageStore,
    invocationStore,
    callbackTokenStore,
    workspaceStore,
    worklists,
    events,
    runtimeStatuses,
    skillResolver,
    contextBuilder,
  });
  const workspaceFiles = new WorkspaceFileService({
    invocationStore,
    callbackTokenStore,
    threadStore,
    events,
    runtimeStatuses,
  });

  return {
    stores: {
      agentStore,
      runtimeStatusStore,
      threadStore,
      messageStore,
      invocationStore,
      callbackTokenStore,
      workspaceStore,
      taskStore,
    },
    agentRegistry,
    runtimeStatuses,
    projectRoot,
    communication,
    contextBuilder,
    skillRegistry,
    workspaceFiles,
    events,
  };
}

function syncAgentStoreFromCatalog(agentStore: AgentStore, projectRoot: string): void {
  const catalog = loadAgentCatalog(projectRoot);
  agentStore.replaceAll(catalog.agents);
}
