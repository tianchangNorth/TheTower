export type ServerEvent =
  | { type: "message.created"; threadId: string; messageId: string }
  | { type: "message.updated"; threadId: string; messageId: string }
  | { type: "invocation.updated"; threadId: string; invocationId: string; status: string }
  | { type: "worklist.updated"; threadId: string; invocationId: string; agents: string[] }
  | {
      type: "agent.event";
      threadId: string;
      invocationId: string;
      agentId: string;
      eventType: "text" | "tool_call" | "error" | "done";
      name?: string;
      error?: string;
    }
  | {
      type: "callback.write";
      threadId: string;
      invocationId: string;
      agentId: string;
      messageId: string;
      visibility: "public" | "private";
      routed: string[];
    }
  | {
      type: "workspace.resolved";
      threadId: string;
      invocationId: string;
      projectPath?: string;
      workingDirectory?: string;
      workspaceFingerprint?: string;
    };

type Listener = (event: ServerEvent) => void;

export class EventBus {
  private readonly listeners = new Set<Listener>();

  publish(event: ServerEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
