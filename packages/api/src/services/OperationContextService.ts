import type {
  OperationCapability,
  OperationCarrier,
  OperationContext,
} from "@the-tower/shared";
import type { CallbackTokenStore } from "../stores/CallbackTokenStore.js";
import type { InvocationStore } from "../stores/InvocationStore.js";

export class CallbackOperationContextError extends Error {
  constructor(message = "invalid callback authorization") {
    super(message);
    this.name = "CallbackOperationContextError";
  }
}

export class OperationContextService {
  constructor(
    private readonly deps: {
      invocationStore: InvocationStore;
      callbackTokenStore: CallbackTokenStore;
    },
  ) {}

  resolveCallback(input: {
    invocationId: string;
    callbackToken: string;
    carrier: OperationCarrier;
    capabilities: OperationCapability[];
    claimedAgentId?: string;
    claimedThreadId?: string;
  }): OperationContext {
    const invocation = this.deps.invocationStore.get(input.invocationId);
    if (!invocation) throw new CallbackOperationContextError("unknown invocation");
    if (invocation.status !== "running") {
      throw new CallbackOperationContextError(`invocation is not running: ${invocation.status}`);
    }

    const grant = this.deps.callbackTokenStore.authenticate(input.invocationId, input.callbackToken);
    if (!grant) throw new CallbackOperationContextError();
    if (input.claimedAgentId && input.claimedAgentId !== grant.agentId) {
      throw new CallbackOperationContextError("callback agent identity does not match authorization grant");
    }
    if (input.claimedThreadId && input.claimedThreadId !== invocation.threadId) {
      throw new CallbackOperationContextError("thread does not belong to invocation");
    }

    return {
      caller: { type: "agent", agentId: grant.agentId },
      threadId: invocation.threadId,
      invocationId: invocation.id,
      ...(grant.stepId ? { stepId: grant.stepId } : {}),
      carrier: input.carrier,
      capabilities: [...input.capabilities],
      trustLevel: "callback_grant",
    };
  }
}

export function assertOperationCapability(
  context: OperationContext,
  capability: OperationCapability,
): void {
  if (!context.capabilities.includes(capability)) {
    throw new CallbackOperationContextError(`operation requires capability: ${capability}`);
  }
}
