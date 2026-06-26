export type ServerEvent =
  | { type: "message.created"; threadId: string; messageId: string }
  | { type: "message.updated"; threadId: string; messageId: string }
  | { type: "invocation.updated"; threadId: string; invocationId: string; status: string }
  | { type: "worklist.updated"; threadId: string; invocationId: string; agents: string[] };

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
