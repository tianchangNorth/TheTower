import { randomBytes } from "node:crypto";
import { nanoid } from "nanoid";
import { AgentRegistry } from "../agents/AgentRegistry.js";
import { RunnerRegistry } from "../agents/RunnerRegistry.js";
import { AgentRuntimeStatusRegistry } from "../agents/AgentRuntimeStatusRegistry.js";
import { ContextBuilder } from "../context/ContextBuilder.js";
import { canQuoteInPublicReply } from "../context/VisibilityPolicy.js";
import { EventBus } from "../events/EventBus.js";
import { shouldRouteAgentText } from "../routing/A2ARoutingPolicy.js";
import { parseA2AMentions, parseMentions } from "../routing/MentionParser.js";
import { WorklistRegistry } from "../routing/WorklistRegistry.js";
import { CallbackTokenStore } from "../stores/CallbackTokenStore.js";
import { InvocationStore } from "../stores/InvocationStore.js";
import { MessageStore } from "../stores/MessageStore.js";
import { ThreadStore } from "../stores/ThreadStore.js";
import { WorkspaceStore } from "../stores/WorkspaceStore.js";
import { SkillResolver } from "../skills/SkillResolver.js";
import { getProviderWorkspacePolicy, resolveThreadWorkspace } from "../workspaces/WorkspaceResolver.js";
import { defaultWorkspaceName, validateProjectPathDetailed } from "../workspaces/projectPath.js";
import type {
  A2ARouteMode,
  AgentEvent,
  AgentRuntimeStatus,
  HandoffPayload,
  Message,
  MessageVisibility,
  PostAgentHandoffPayloadRequest,
} from "../types.js";

const DEFAULT_MAX_A2A_DEPTH = 10;
const CALLBACK_TOKEN_TTL_MS = 60 * 60 * 1000;

export class CommunicationService {
  constructor(
    private readonly deps: {
      agentRegistry: AgentRegistry;
      runnerRegistry: RunnerRegistry;
      threadStore: ThreadStore;
      messageStore: MessageStore;
      invocationStore: InvocationStore;
      callbackTokenStore: CallbackTokenStore;
      workspaceStore: WorkspaceStore;
      worklists: WorklistRegistry;
      events: EventBus;
      runtimeStatuses: AgentRuntimeStatusRegistry;
      skillResolver?: SkillResolver;
      contextBuilder: ContextBuilder;
    },
  ) {}

  async postUserMessage(input: {
    threadId?: string;
    content: string;
    projectPath?: string;
    workspaceId?: string;
    targetAgents?: string[];
    routeMode?: A2ARouteMode;
  }): Promise<{
    threadId: string;
    messageId: string;
    invocationId: string;
    targetAgents: string[];
  }> {
    const now = Date.now();
    const threadId = input.threadId ?? nanoid();
    if (!this.deps.threadStore.get(threadId)) {
      const projectPath = await this.resolveNewThreadProjectPath(input);
      this.deps.threadStore.create({
        id: threadId,
        title: makeThreadTitle(input.content),
        mode: "play",
        projectPath,
        createdAt: now,
        updatedAt: now,
      });
    }

    const targetAgents = this.resolveUserTargets(input.content, input.targetAgents);
    this.assertEnabledAgents(targetAgents, "targetAgents");
    const routeMode = normalizeRouteMode(input.routeMode, targetAgents);
    const message: Message = {
      id: nanoid(),
      threadId,
      senderType: "user",
      content: input.content,
      mentions: targetAgents,
      origin: "user",
      deliveryStatus: "delivered",
      createdAt: now,
    };
    this.deps.messageStore.create(message);
    this.deps.threadStore.touch(threadId, now);
    this.deps.events.publish({ type: "message.created", threadId, messageId: message.id });

    const invocationId = await this.startInvocation({
      threadId,
      rootMessageId: message.id,
      targetAgents,
      routeMode,
    });

    return { threadId, messageId: message.id, invocationId, targetAgents };
  }

  async postAgentMessage(input: {
    invocationId: string;
    callbackToken: string;
    agentId: string;
    content: string;
    targetAgents?: string[];
    routeMode?: A2ARouteMode;
    visibility?: MessageVisibility;
    visibleToAgentIds?: string[];
    handoffPayload?: PostAgentHandoffPayloadRequest;
    replyTo?: string;
  }): Promise<{ messageId: string; routed: string[] }> {
    const invocation = this.deps.invocationStore.get(input.invocationId);
    if (!invocation) throw new Error("unknown invocation");
    if (invocation.status !== "running") throw new Error(`invocation is not running: ${invocation.status}`);
    if (!this.deps.callbackTokenStore.verify(input.invocationId, input.callbackToken)) {
      throw new Error("invalid callback token");
    }

    const entry = this.deps.worklists.get(input.invocationId);
    const routeModeForCallback = input.routeMode ?? entry?.routeMode;
    const parsedTargets = routeModeForCallback && canRouteFromAgentText(routeModeForCallback) && shouldRouteAgentText(input.content)
      ? this.resolveAgentTargets(input.content)
      : [];
    const targetAgents = unique([
      ...(input.targetAgents ?? []),
      ...parsedTargets,
      ...(input.handoffPayload?.toAgentIds ?? []),
    ]);
    this.assertEnabledAgents(targetAgents, "targetAgents");
    const callbackFields = this.normalizeCallbackMessageFields({
      agentId: input.agentId,
      targetAgents,
      visibility: input.visibility,
      visibleToAgentIds: input.visibleToAgentIds,
      handoffPayload: input.handoffPayload,
    });
    this.assertCanPubliclyReplyTo(input.replyTo);
    const duplicate = this.findExactCallbackDuplicate({
      threadId: invocation.threadId,
      invocationId: input.invocationId,
      agentId: input.agentId,
      content: input.content,
      mentions: targetAgents,
      visibility: callbackFields.visibility,
      visibleToAgentIds: callbackFields.visibleToAgentIds,
      replyTo: input.replyTo,
    });
    if (duplicate) {
      return { messageId: duplicate.id, routed: [] };
    }
    const message: Message = {
      id: nanoid(),
      threadId: invocation.threadId,
      senderType: "agent",
      senderId: input.agentId,
      content: input.content,
      mentions: targetAgents,
      visibility: callbackFields.visibility,
      visibleToAgentIds: callbackFields.visibleToAgentIds,
      handoffPayload: callbackFields.handoffPayload,
      extra: { isExplicitPost: true },
      origin: "callback",
      deliveryStatus: "delivered",
      invocationId: input.invocationId,
      replyTo: input.replyTo,
      createdAt: Date.now(),
    };
    this.deps.messageStore.create(message);
    this.deps.threadStore.touch(invocation.threadId, message.createdAt);
    this.deps.events.publish({ type: "message.created", threadId: invocation.threadId, messageId: message.id });

    const push = this.deps.worklists.push({
      invocationId: input.invocationId,
      targetAgents,
      callerAgentId: input.agentId,
      triggerMessageId: message.id,
      sourceOrigin: "callback",
    });
    const routed = push.ok ? push.added : [];
    if (routed.length > 0) {
      const entry = this.deps.worklists.get(input.invocationId);
      this.deps.events.publish({
        type: "worklist.updated",
        threadId: invocation.threadId,
        invocationId: input.invocationId,
        agents: entry?.list ?? [],
      });
    }
    this.deps.events.publish({
      type: "callback.write",
      threadId: invocation.threadId,
      invocationId: input.invocationId,
      agentId: input.agentId,
      messageId: message.id,
      visibility: callbackFields.visibility,
      routed,
    });
    return { messageId: message.id, routed };
  }

  getThreadContext(threadId: string, limit = 100): Message[] {
    return this.deps.messageStore.listByThread(threadId, limit);
  }

  revealMessage(input: { threadId: string; messageId: string }): Message {
    const message = this.deps.messageStore.get(input.messageId);
    if (!message || message.threadId !== input.threadId) {
      throw new Error("message not found");
    }
    if (message.visibility !== "private") {
      throw new Error("only private messages can be revealed");
    }
    if (message.revealedAt) return message;

    const revealed = this.deps.messageStore.reveal(input.messageId);
    if (!revealed) throw new Error("message not found");
    this.deps.threadStore.touch(input.threadId, revealed.revealedAt ?? Date.now());
    this.deps.events.publish({ type: "message.updated", threadId: input.threadId, messageId: input.messageId });
    return revealed;
  }

  getThreadContextForCallback(input: {
    invocationId: string;
    callbackToken: string;
    threadId: string;
    limit?: number;
  }): Message[] {
    const invocation = this.deps.invocationStore.get(input.invocationId);
    if (!invocation) throw new Error("unknown invocation");
    if (invocation.status !== "running") throw new Error(`invocation is not running: ${invocation.status}`);
    if (invocation.threadId !== input.threadId) throw new Error("thread does not belong to invocation");
    if (!this.deps.callbackTokenStore.verify(input.invocationId, input.callbackToken)) {
      throw new Error("invalid callback token");
    }
    const entry = this.deps.worklists.get(input.invocationId);
    const agentId = entry?.list[entry.currentIndex];
    if (!agentId) throw new Error("cannot resolve callback agent");
    return this.deps.contextBuilder.buildForAgent({
      threadId: input.threadId,
      agentId,
      mode: this.getThreadMode(input.threadId),
      limit: input.limit ?? 100,
    }).messages;
  }

  private async startInvocation(input: {
    threadId: string;
    rootMessageId: string;
    targetAgents: string[];
    routeMode: A2ARouteMode;
  }): Promise<string> {
    const invocationId = nanoid();
    const callbackToken = randomBytes(24).toString("base64url");
    const now = Date.now();
    const abortController = new AbortController();

    this.deps.invocationStore.create({
      id: invocationId,
      threadId: input.threadId,
      rootMessageId: input.rootMessageId,
      status: "queued",
      targetAgents: input.targetAgents,
      routeMode: input.routeMode,
      depth: 0,
      createdAt: now,
    });
    this.deps.callbackTokenStore.create({
      invocationId,
      token: callbackToken,
      expiresAt: now + CALLBACK_TOKEN_TTL_MS,
    });
    this.deps.worklists.register({
      invocationId,
      threadId: input.threadId,
      targetAgents: input.targetAgents,
      routeMode: input.routeMode,
      maxDepth: DEFAULT_MAX_A2A_DEPTH,
      abortController,
    });

    void this.executeWorklist(invocationId, callbackToken).catch((err) => {
      this.appendSystemMessage(input.threadId, invocationId, `Invocation failed: ${(err as Error).message}`);
      this.finishInvocation(invocationId, input.threadId, "failed");
    });

    return invocationId;
  }

  private async executeWorklist(invocationId: string, callbackToken: string): Promise<void> {
    const entry = this.deps.worklists.get(invocationId);
    const invocation = this.deps.invocationStore.get(invocationId);
    if (!entry || !invocation) return;

    this.deps.invocationStore.updateStatus(invocationId, "running");
    this.deps.events.publish({ type: "invocation.updated", threadId: entry.threadId, invocationId, status: "running" });

    while (entry.currentIndex < entry.list.length) {
      if (entry.abortController.signal.aborted) {
        this.finishInvocation(invocationId, entry.threadId, "cancelled");
        return;
      }

      const agentId = entry.list[entry.currentIndex];
      const agent = this.deps.agentRegistry.get(agentId);
      if (!agent || !agent.enabled) {
        this.appendSystemMessage(entry.threadId, invocationId, `Agent "${agentId}" is unavailable; skipped.`);
        entry.currentIndex++;
        continue;
      }

      const context = this.deps.contextBuilder.buildForAgent({
        threadId: entry.threadId,
        agentId,
        mode: this.getThreadMode(entry.threadId),
        limit: 100,
      });
      const messages = context.messages;
      const runner = this.deps.runnerRegistry.getRunner(agent);
      let workspace;
      try {
        workspace = await resolveThreadWorkspace(this.deps.threadStore.get(entry.threadId));
        this.deps.events.publish({
          type: "workspace.resolved",
          threadId: entry.threadId,
          invocationId,
          projectPath: workspace.projectPath,
          workingDirectory: workspace.workingDirectory,
          workspaceFingerprint: workspace.workspaceFingerprint,
        });
        const policy = getProviderWorkspacePolicy(agent.provider);
        if (policy.requiresThreadWorkspace && !workspace.workingDirectory) {
          throw new Error(
            `${agent.provider} requires a project workspace for this thread. Bind the thread to an existing directory under /Users/xuchenyang before running ${agent.provider}.`,
          );
        }
      } catch (err) {
        const message = (err as Error).message;
        this.appendSystemMessage(entry.threadId, invocationId, `${agentId} workspace error: ${message}`);
        this.deps.events.publish({
          type: "agent.event",
          threadId: entry.threadId,
          invocationId,
          agentId,
          eventType: "error",
          error: message,
          createdAt: Date.now(),
        });
        this.finishInvocation(invocationId, entry.threadId, "failed");
        return;
      }
      const availableAgents = this.deps.agentRegistry.list().filter((item) => item.enabled);
      const worklistSnapshot = [...entry.list];
      const activeSkills = this.deps.skillResolver?.resolve({
        agent,
        messages,
        worklist: entry,
      });
      this.deps.events.publish({
        type: "agent.event",
        threadId: entry.threadId,
        invocationId,
        agentId,
        eventType: "skills_loaded",
        skillIds: (activeSkills ?? []).map((skill) => skill.id),
        createdAt: Date.now(),
      });
      this.publishAgentStatus({
        threadId: entry.threadId,
        invocationId,
        agentId,
        status: "thinking",
      });
      for await (const event of runner.run({
        agent,
        availableAgents,
        worklistAgents: worklistSnapshot,
        worklistIndex: entry.currentIndex,
        routeMode: entry.routeMode,
        remainingAgents: worklistSnapshot.slice(entry.currentIndex + 1),
        directMessageFrom: entry.a2aFrom[agentId],
        a2aEnabled: entry.depth < entry.maxDepth && canRouteFromAgentText(entry.routeMode),
        threadId: entry.threadId,
        invocationId,
        projectPath: workspace.projectPath,
        workingDirectory: workspace.workingDirectory,
        workspaceFingerprint: workspace.workspaceFingerprint,
        messages,
        activeSkills,
        callbackToken,
        signal: entry.abortController.signal,
      })) {
        await this.handleAgentEvent(entry.threadId, invocationId, agentId, event);
      }
      entry.currentIndex++;
    }

    this.finishInvocation(invocationId, entry.threadId, "done");
  }

  private async handleAgentEvent(
    threadId: string,
    invocationId: string,
    agentId: string,
    event: AgentEvent,
  ): Promise<void> {
    if (event.type === "liveness") {
      const status = this.deps.runtimeStatuses.setLiveness({
        threadId,
        invocationId,
        agentId,
        liveness: event.liveness,
      });
      this.deps.events.publish({
        type: "agent.liveness",
        threadId,
        invocationId,
        agentId,
        status,
        createdAt: status.updatedAt,
      });
      return;
    }
    if (event.type === "text" || event.type === "stream_text") {
      this.publishAgentStatus({ threadId, invocationId, agentId, status: "replying" });
      this.deps.events.publish({ type: "agent.event", threadId, invocationId, agentId, eventType: "text", createdAt: Date.now() });
      this.postStreamChunk({
        threadId,
        invocationId,
        agentId,
        content: event.content,
        chunkType: "text",
        speechContent: event.type === "text",
      });
    } else if (event.type === "tool_call") {
      this.publishAgentStatus({
        threadId,
        invocationId,
        agentId,
        status: "tool_calling",
        currentToolName: event.name,
      });
      this.deps.events.publish({
        type: "agent.event",
        threadId,
        invocationId,
        agentId,
        eventType: "tool_call",
        name: event.name,
        createdAt: Date.now(),
      });
      this.postStreamChunk({
        threadId,
        invocationId,
        agentId,
        content: `${event.name}(${summarizeToolInput(event.input)})`,
        chunkType: "tool_call",
        toolName: event.name,
      });
    } else if (event.type === "thinking") {
      this.publishAgentStatus({ threadId, invocationId, agentId, status: "thinking" });
      if (event.content) {
        this.postStreamChunk({ threadId, invocationId, agentId, content: event.content, chunkType: "thinking" });
      }
    } else if (event.type === "token_usage") {
      const status = this.deps.runtimeStatuses.setTokenUsage({
        threadId,
        invocationId,
        agentId,
        usage: event.usage,
      });
      this.deps.events.publish({
        type: "agent.token_usage",
        threadId,
        invocationId,
        agentId,
        status,
        createdAt: status.updatedAt,
      });
    } else if (event.type === "error") {
      this.publishAgentStatus({ threadId, invocationId, agentId, status: "error", detail: event.error });
      this.deps.events.publish({
        type: "agent.event",
        threadId,
        invocationId,
        agentId,
        eventType: "error",
        error: event.error,
        createdAt: Date.now(),
      });
      this.appendSystemMessage(threadId, invocationId, `${agentId} error: ${event.error}`);
    } else if (event.type === "done") {
      this.publishAgentStatus({ threadId, invocationId, agentId, status: "done" });
      this.deps.events.publish({ type: "agent.event", threadId, invocationId, agentId, eventType: "done", createdAt: Date.now() });
    }
  }

  private postStreamChunk(input: {
    threadId: string;
    invocationId: string;
    agentId: string;
    content: string;
    chunkType: "thinking" | "text" | "tool_call" | "error";
    toolName?: string;
    speechContent?: boolean;
  }): void {
    const streamExtra: NonNullable<Message["extra"]>["stream"] = {
      invocationId: input.invocationId,
      chunkType: input.chunkType,
    };
    if (input.toolName) streamExtra.toolName = input.toolName;
    if (input.speechContent) streamExtra.speechContent = input.content;
    const message: Message = {
      id: nanoid(),
      threadId: input.threadId,
      senderType: "agent",
      senderId: input.agentId,
      content: input.content,
      mentions: [],
      origin: "agent_stream",
      deliveryStatus: "delivered",
      invocationId: input.invocationId,
      extra: { stream: streamExtra },
      createdAt: Date.now(),
    };
    this.deps.messageStore.create(message);
    this.deps.threadStore.touch(input.threadId, message.createdAt);
    this.deps.events.publish({ type: "message.created", threadId: input.threadId, messageId: message.id });
  }

  private findExactCallbackDuplicate(input: {
    threadId: string;
    invocationId: string;
    agentId: string;
    content: string;
    mentions: string[];
    visibility: MessageVisibility;
    visibleToAgentIds?: string[];
    replyTo?: string;
  }): Message | undefined {
    const normalizedContent = normalizeContent(input.content);
    const messages = this.deps.messageStore.listByInvocation({
      threadId: input.threadId,
      invocationId: input.invocationId,
      senderId: input.agentId,
      limit: 50,
    });
    return messages.find((message) => {
      if (message.origin !== "callback") return false;
      if (normalizeContent(message.content) !== normalizedContent) return false;
      if ((message.visibility ?? "public") !== input.visibility) return false;
      if ((message.replyTo ?? undefined) !== (input.replyTo ?? undefined)) return false;
      if (!sameStringList(message.mentions, input.mentions)) return false;
      if (!sameStringList(message.visibleToAgentIds ?? [], input.visibleToAgentIds ?? [])) return false;
      return true;
    });
  }

  private appendSystemMessage(threadId: string, invocationId: string, content: string): void {
    const message: Message = {
      id: nanoid(),
      threadId,
      senderType: "system",
      content,
      mentions: [],
      origin: "system",
      deliveryStatus: "delivered",
      invocationId,
      createdAt: Date.now(),
    };
    this.deps.messageStore.create(message);
    this.deps.events.publish({ type: "message.created", threadId, messageId: message.id });
  }

  private finishInvocation(invocationId: string, threadId: string, status: "done" | "failed" | "cancelled"): void {
    const entry = this.deps.worklists.get(invocationId);
    if (entry && status !== "done") {
      for (const agentId of entry.list) {
        this.publishAgentStatus({
          threadId,
          invocationId,
          agentId,
          status: status === "failed" ? "error" : "idle",
          detail: status,
        });
      }
    }
    this.deps.invocationStore.updateStatus(invocationId, status, Date.now());
    this.deps.callbackTokenStore.deactivate(invocationId);
    this.deps.worklists.unregister(invocationId);
    this.deps.events.publish({ type: "invocation.updated", threadId, invocationId, status });
  }

  private publishAgentStatus(input: {
    threadId: string;
    invocationId: string;
    agentId: string;
    status: AgentRuntimeStatus["status"];
    detail?: string;
    currentToolName?: string;
  }): AgentRuntimeStatus {
    const status =
      input.status === "thinking"
        ? this.deps.runtimeStatuses.markSessionStarted(input)
        : this.deps.runtimeStatuses.setStatus(input);
    this.deps.events.publish({
      type: "agent.status",
      threadId: input.threadId,
      invocationId: input.invocationId,
      agentId: input.agentId,
      status,
      createdAt: status.updatedAt,
    });
    return status;
  }

  private resolveTargets(content: string, options?: { allowDefault?: boolean }): string[] {
    const allowDefault = options?.allowDefault ?? true;
    const agents = this.deps.agentRegistry.list().filter((agent) => agent.enabled);
    const parsed = parseMentions(content, agents);
    if (parsed.length > 0) return parsed;
    if (!allowDefault) return [];
    const first = agents[0];
    if (!first) throw new Error("No enabled agents registered");
    return [first.id];
  }

  private resolveAgentTargets(content: string): string[] {
    const agents = this.deps.agentRegistry.list().filter((agent) => agent.enabled);
    return parseA2AMentions(content, agents);
  }

  private resolveUserTargets(content: string, structuredTargets: string[] | undefined): string[] {
    const parsedTargets = this.resolveTargets(content, { allowDefault: false });
    const targetAgents = unique([...(structuredTargets ?? []), ...parsedTargets]);
    if (targetAgents.length > 0) return targetAgents;
    return this.resolveTargets(content);
  }

  private getThreadMode(threadId: string): "debug" | "play" {
    return this.deps.threadStore.get(threadId)?.mode ?? "play";
  }

  private async resolveNewThreadProjectPath(input: { projectPath?: string; workspaceId?: string }): Promise<string | undefined> {
    if (input.workspaceId) {
      const workspace = this.deps.workspaceStore.get(input.workspaceId);
      if (!workspace) throw new Error(`workspace not found: ${input.workspaceId}`);
      this.deps.workspaceStore.upsert({ ...workspace, lastOpenedAt: Date.now() });
      return workspace.projectPath;
    }
    const rawPath = input.projectPath?.trim();
    if (!rawPath) return undefined;
    const result = await validateProjectPathDetailed(rawPath);
    if (!result.ok) throw new Error(result.message ?? `Invalid project path: ${result.reason}`);
    const now = Date.now();
    this.deps.workspaceStore.upsert({
      id: nanoid(),
      name: defaultWorkspaceName(result.path),
      projectPath: result.path,
      trustedAt: now,
      lastOpenedAt: now,
      createdAt: now,
    });
    return result.path;
  }

  private normalizeCallbackMessageFields(input: {
    agentId: string;
    targetAgents: string[];
    visibility?: MessageVisibility;
    visibleToAgentIds?: string[];
    handoffPayload?: PostAgentHandoffPayloadRequest;
  }): {
    visibility: MessageVisibility;
    visibleToAgentIds?: string[];
    handoffPayload?: HandoffPayload;
  } {
    const visibility = input.visibility ?? "public";
    if (visibility === "public" && input.visibleToAgentIds && input.visibleToAgentIds.length > 0) {
      throw new Error("visibleToAgentIds is only valid when visibility is private");
    }

    const handoffPayload = input.handoffPayload
      ? this.normalizeHandoffPayload(input.agentId, input.handoffPayload)
      : undefined;

    if (visibility === "public") {
      return { visibility, handoffPayload };
    }

    const visibleToAgentIds = unique([
      ...(input.visibleToAgentIds ?? []),
      ...input.targetAgents,
      input.agentId,
    ]);
    this.assertEnabledAgents(visibleToAgentIds, "visibleToAgentIds");
    if (visibleToAgentIds.length === 1 && visibleToAgentIds[0] === input.agentId) {
      throw new Error("private callback messages require visibleToAgentIds, targetAgents, or handoffPayload.toAgentIds");
    }

    return { visibility, visibleToAgentIds, handoffPayload };
  }

  private normalizeHandoffPayload(agentId: string, payload: PostAgentHandoffPayloadRequest): HandoffPayload {
    if (payload.fromAgentId && payload.fromAgentId !== agentId) {
      throw new Error(`handoffPayload.fromAgentId must match caller agent: ${agentId}`);
    }
    this.assertEnabledAgents(payload.toAgentIds, "handoffPayload.toAgentIds");
    return {
      ...payload,
      fromAgentId: agentId,
      openQuestions: payload.openQuestions ?? [],
      createdAt: payload.createdAt ?? Date.now(),
    };
  }

  private assertEnabledAgents(agentIds: string[], fieldName: string): void {
    const enabled = new Set(this.deps.agentRegistry.list().filter((agent) => agent.enabled).map((agent) => agent.id));
    const unknown = unique(agentIds).filter((agentId) => !enabled.has(agentId));
    if (unknown.length > 0) {
      throw new Error(`${fieldName} contains unknown or disabled agents: ${unknown.join(", ")}`);
    }
  }

  private assertCanPubliclyReplyTo(replyTo: string | undefined): void {
    if (!replyTo) return;
    const parent = this.deps.messageStore.get(replyTo);
    if (!parent) throw new Error(`replyTo message not found: ${replyTo}`);
    if (!canQuoteInPublicReply(parent)) {
      throw new Error(`replyTo message cannot be quoted by a public callback message: ${replyTo}`);
    }
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function sameStringList(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function normalizeContent(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

function summarizeToolInput(input: unknown): string {
  try {
    const json = JSON.stringify(input);
    return json.length > 500 ? `${json.slice(0, 500)}…` : json;
  } catch {
    return String(input);
  }
}

function normalizeRouteMode(routeMode: A2ARouteMode | undefined, targetAgents: string[]): A2ARouteMode {
  if (routeMode) return routeMode;
  return targetAgents.length > 1 ? "fanout" : "single";
}

function canRouteFromAgentText(routeMode: A2ARouteMode): boolean {
  return routeMode === "single" || routeMode === "serial";
}

function makeThreadTitle(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 40 ? `${compact.slice(0, 40)}...` : compact || "New thread";
}
