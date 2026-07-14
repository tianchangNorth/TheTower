import { AgentRegistry } from "./agents/AgentRegistry.js";
import { AgentRuntimeStatusRegistry } from "./agents/AgentRuntimeStatusRegistry.js";
import { RunnerRegistry } from "./agents/RunnerRegistry.js";
import { bootstrapAgentCatalog, loadAgentCatalog, resolveProjectRoot } from "./config/AgentConfigLoader.js";
import { ContextBuilder } from "./context/ContextBuilder.js";
import { db } from "./db/database.js";
import { initSchema } from "./db/schema.js";
import { EventBus } from "./events/EventBus.js";
import { EventLogStore } from "./stores/EventLogStore.js";
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
import { OperationContextService } from "./services/OperationContextService.js";
import { createDefaultSkillResolver } from "./skills/SkillResolver.js";
import type { Agent } from "./types.js";
import type Database from "better-sqlite3";

export interface CreateAppContextOptions {
  database?: Database.Database;
  projectRoot?: string;
  agents?: Agent[];
  runnerRegistry?: RunnerRegistry;
}

export function createAppContext(options: CreateAppContextOptions = {}) {
  const database = options.database ?? db;
  initSchema(database);

  const agentStore = new AgentStore(database);
  const projectRoot = options.projectRoot ?? resolveProjectRoot();
  if (options.agents) {
    agentStore.replaceAll(options.agents);
  } else {
    bootstrapAgentCatalog(projectRoot);
    syncAgentStoreFromCatalog(agentStore, projectRoot);
  }

  const agentRegistry = new AgentRegistry();
  agentRegistry.replaceAll(agentStore.list());
  const runtimeStatusStore = new AgentRuntimeStatusStore(database);
  const runtimeStatuses = new AgentRuntimeStatusRegistry(runtimeStatusStore);

  const threadStore = new ThreadStore(database);
  const messageStore = new MessageStore(database);
  const invocationStore = new InvocationStore(database);
  const callbackTokenStore = new CallbackTokenStore(database);
  const workspaceStore = new WorkspaceStore(database);
  const taskStore = new TaskStore(database);
  const worklists = new WorklistRegistry();
  const eventLogStore = new EventLogStore(database);
  const events = new EventBus(eventLogStore);
  const runnerRegistry = options.runnerRegistry ?? new RunnerRegistry();
  const skillResolver = createDefaultSkillResolver(projectRoot);
  const skillRegistry = skillResolver.getRegistry();
  const contextBuilder = new ContextBuilder({ messageStore });
  const operationContexts = new OperationContextService({ invocationStore, callbackTokenStore });

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
      eventLogStore,
    },
    agentRegistry,
    runtimeStatuses,
    projectRoot,
    communication,
    worklists,
    contextBuilder,
    operationContexts,
    skillRegistry,
    workspaceFiles,
    events,
  };
}

function syncAgentStoreFromCatalog(agentStore: AgentStore, projectRoot: string): void {
  const catalog = loadAgentCatalog(projectRoot);
  agentStore.replaceAll(catalog.agents);
}
