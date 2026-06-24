import { randomBytes } from "node:crypto";
import { nanoid } from "nanoid";
import { AgentRegistry } from "../agents/AgentRegistry.js";
import { RunnerRegistry } from "../agents/RunnerRegistry.js";
import { EventBus } from "../events/EventBus.js";
import { shouldRouteAgentText } from "../routing/A2ARoutingPolicy.js";
import { parseMentions } from "../routing/MentionParser.js";
import { WorklistRegistry } from "../routing/WorklistRegistry.js";
import { CallbackTokenStore } from "../stores/CallbackTokenStore.js";
import { InvocationStore } from "../stores/InvocationStore.js";
import { MessageStore } from "../stores/MessageStore.js";
import { ThreadStore } from "../stores/ThreadStore.js";
import type { AgentEvent, Message } from "../types.js";

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
      worklists: WorklistRegistry;
      events: EventBus;
    },
  ) {}

  async postUserMessage(input: { threadId?: string; content: string }): Promise<{
    threadId: string;
    messageId: string;
    invocationId: string;
    targetAgents: string[];
  }> {
    const now = Date.now();
    const threadId = input.threadId ?? nanoid();
    if (!this.deps.threadStore.get(threadId)) {
      this.deps.threadStore.create({
        id: threadId,
        title: makeThreadTitle(input.content),
        createdAt: now,
        updatedAt: now,
      });
    }

    const targetAgents = this.resolveTargets(input.content);
    const message: Message = {
      id: nanoid(),
      threadId,
      senderType: "user",
      content: input.content,
      mentions: targetAgents,
      createdAt: now,
    };
    this.deps.messageStore.create(message);
    this.deps.threadStore.touch(threadId, now);
    this.deps.events.publish({ type: "message.created", threadId, messageId: message.id });

    const invocationId = await this.startInvocation({
      threadId,
      rootMessageId: message.id,
      targetAgents,
    });

    return { threadId, messageId: message.id, invocationId, targetAgents };
  }

  async postAgentMessage(input: {
    invocationId: string;
    callbackToken: string;
    agentId: string;
    content: string;
    targetAgents?: string[];
    replyTo?: string;
  }): Promise<{ messageId: string; routed: string[] }> {
    const invocation = this.deps.invocationStore.get(input.invocationId);
    if (!invocation) throw new Error("unknown invocation");
    if (invocation.status !== "running") throw new Error(`invocation is not running: ${invocation.status}`);
    if (!this.deps.callbackTokenStore.verify(input.invocationId, input.callbackToken)) {
      throw new Error("invalid callback token");
    }

    const parsedTargets = shouldRouteAgentText(input.content)
      ? this.resolveTargets(input.content, { allowDefault: false })
      : [];
    const targetAgents = unique([...(input.targetAgents ?? []), ...parsedTargets]);
    const message: Message = {
      id: nanoid(),
      threadId: invocation.threadId,
      senderType: "agent",
      senderId: input.agentId,
      content: input.content,
      mentions: targetAgents,
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
    return { messageId: message.id, routed };
  }

  getThreadContext(threadId: string, limit = 100): Message[] {
    return this.deps.messageStore.listByThread(threadId, limit);
  }

  private async startInvocation(input: {
    threadId: string;
    rootMessageId: string;
    targetAgents: string[];
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

      const messages = this.deps.messageStore.listByThread(entry.threadId, 100);
      const runner = this.deps.runnerRegistry.getRunner(agent);
      for await (const event of runner.run({
        agent,
        threadId: entry.threadId,
        invocationId,
        messages,
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
    if (event.type === "text") {
      await this.postInternalAgentText({ threadId, invocationId, agentId, content: event.content });
    } else if (event.type === "error") {
      this.appendSystemMessage(threadId, invocationId, `${agentId} error: ${event.error}`);
    }
  }

  private async postInternalAgentText(input: {
    threadId: string;
    invocationId: string;
    agentId: string;
    content: string;
  }): Promise<void> {
    const targetAgents = shouldRouteAgentText(input.content)
      ? this.resolveTargets(input.content, { allowDefault: false })
      : [];
    const message: Message = {
      id: nanoid(),
      threadId: input.threadId,
      senderType: "agent",
      senderId: input.agentId,
      content: input.content,
      mentions: targetAgents,
      invocationId: input.invocationId,
      createdAt: Date.now(),
    };
    this.deps.messageStore.create(message);
    this.deps.threadStore.touch(input.threadId, message.createdAt);
    this.deps.events.publish({ type: "message.created", threadId: input.threadId, messageId: message.id });

    if (targetAgents.length > 0) {
      const push = this.deps.worklists.push({
        invocationId: input.invocationId,
        targetAgents,
        callerAgentId: input.agentId,
        triggerMessageId: message.id,
      });
      if (!push.ok && push.reason === "pingpong_blocked") {
        this.appendSystemMessage(input.threadId, input.invocationId, "A2A ping-pong blocked.");
      }
    }
  }

  private appendSystemMessage(threadId: string, invocationId: string, content: string): void {
    const message: Message = {
      id: nanoid(),
      threadId,
      senderType: "system",
      content,
      mentions: [],
      invocationId,
      createdAt: Date.now(),
    };
    this.deps.messageStore.create(message);
    this.deps.events.publish({ type: "message.created", threadId, messageId: message.id });
  }

  private finishInvocation(invocationId: string, threadId: string, status: "done" | "failed" | "cancelled"): void {
    this.deps.invocationStore.updateStatus(invocationId, status, Date.now());
    this.deps.callbackTokenStore.deactivate(invocationId);
    this.deps.worklists.unregister(invocationId);
    this.deps.events.publish({ type: "invocation.updated", threadId, invocationId, status });
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
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function makeThreadTitle(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 40 ? `${compact.slice(0, 40)}...` : compact || "New thread";
}
