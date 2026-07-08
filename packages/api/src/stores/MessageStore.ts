import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type {
  HandoffPayload,
  Message,
  MessageDeliveryStatus,
  MessageExtra,
  MessageOrigin,
  MessageToolEvent,
  MessageVisibility,
  SenderType,
} from "../types.js";

interface MessageRow {
  id: string;
  thread_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  content: string;
  thinking: string | null;
  mentions_json: string;
  visibility: MessageVisibility | null;
  visible_to_agent_ids_json: string | null;
  revealed_at: number | null;
  origin: MessageOrigin | null;
  delivery_status: MessageDeliveryStatus | null;
  handoff_payload_json: string | null;
  tool_events_json: string | null;
  extra_json: string | null;
  invocation_id: string | null;
  reply_to: string | null;
  created_at: number;
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderType: row.sender_type,
    senderId: row.sender_id ?? undefined,
    content: row.content,
    thinking: row.thinking ?? undefined,
    mentions: JSON.parse(row.mentions_json) as string[],
    visibility: row.visibility ?? "public",
    visibleToAgentIds: parseOptionalJson<string[]>(row.visible_to_agent_ids_json),
    revealedAt: row.revealed_at ?? undefined,
    origin: row.origin ?? inferOrigin(row.sender_type),
    deliveryStatus: row.delivery_status ?? "delivered",
    handoffPayload: parseOptionalJson<HandoffPayload>(row.handoff_payload_json),
    toolEvents: parseOptionalJson<MessageToolEvent[]>(row.tool_events_json),
    extra: parseOptionalJson<MessageExtra>(row.extra_json),
    invocationId: row.invocation_id ?? undefined,
    replyTo: row.reply_to ?? undefined,
    createdAt: row.created_at,
  };
}

export class MessageStore {
  constructor(private readonly db: Database.Database) {}

  create(message: Message): void {
    this.db
      .prepare(
        `
        INSERT INTO messages (
          id,
          thread_id,
          sender_type,
          sender_id,
          content,
          thinking,
          mentions_json,
          visibility,
          visible_to_agent_ids_json,
          revealed_at,
          origin,
          delivery_status,
          handoff_payload_json,
          tool_events_json,
          extra_json,
          invocation_id,
          reply_to,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        message.id,
        message.threadId,
        message.senderType,
        message.senderId ?? null,
        message.content,
        message.thinking ?? null,
        JSON.stringify(message.mentions),
        message.visibility ?? "public",
        message.visibleToAgentIds ? JSON.stringify(message.visibleToAgentIds) : null,
        message.revealedAt ?? null,
        message.origin ?? inferOrigin(message.senderType),
        message.deliveryStatus ?? "delivered",
        message.handoffPayload ? JSON.stringify(message.handoffPayload) : null,
        message.toolEvents ? JSON.stringify(message.toolEvents) : null,
        message.extra ? JSON.stringify(message.extra) : null,
        message.invocationId ?? null,
        message.replyTo ?? null,
        message.createdAt,
      );
  }

  get(id: string): Message | null {
    const row = this.db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as MessageRow | undefined;
    return row ? toMessage(row) : null;
  }

  reveal(id: string, revealedAt = Date.now()): Message | null {
    this.db.prepare("UPDATE messages SET revealed_at = ? WHERE id = ?").run(revealedAt, id);
    return this.get(id);
  }

  appendThinkingChunk(input: {
    threadId: string;
    invocationId: string;
    senderId: string;
    content: string;
    mode?: "delta" | "snapshot" | "block";
    createdAt?: number;
  }): { message: Message; created: boolean } {
    const existing = this.findStreamMessage(input);
    if (existing) {
      const next = this.appendThinkingToMessage(existing, input.content, input.mode ?? "block");
      return { message: next, created: false };
    }

    const message: Message = {
      id: nanoid(),
      threadId: input.threadId,
      senderType: "agent",
      senderId: input.senderId,
      content: "",
      thinking: input.content,
      mentions: [],
      origin: "agent_stream",
      deliveryStatus: "delivered",
      invocationId: input.invocationId,
      extra: { stream: { invocationId: input.invocationId, chunkType: "thinking" } },
      createdAt: input.createdAt ?? Date.now(),
    };
    this.create(message);
    return { message, created: true };
  }

  appendStreamText(input: {
    threadId: string;
    invocationId: string;
    senderId: string;
    content: string;
    createdAt?: number;
  }): { message: Message; created: boolean } {
    const existing = this.findStreamMessage(input);
    if (existing) {
      const content = appendTextBlock(existing.content, input.content);
      const next: Message = {
        ...existing,
        content,
        extra: {
          ...existing.extra,
          stream: {
            ...existing.extra?.stream,
            invocationId: input.invocationId,
            chunkType: "text",
            cliStdout: content,
          },
        },
      };
      this.updateContentThinkingToolEventsAndExtra(next);
      return { message: next, created: false };
    }

    const message: Message = {
      id: nanoid(),
      threadId: input.threadId,
      senderType: "agent",
      senderId: input.senderId,
      content: input.content,
      mentions: [],
      origin: "agent_stream",
      deliveryStatus: "delivered",
      invocationId: input.invocationId,
      extra: { stream: { invocationId: input.invocationId, chunkType: "text", cliStdout: input.content } },
      createdAt: input.createdAt ?? Date.now(),
    };
    this.create(message);
    return { message, created: true };
  }

  appendToolEvent(input: {
    threadId: string;
    invocationId: string;
    senderId: string;
    event: MessageToolEvent;
    createdAt?: number;
  }): { message: Message; created: boolean } {
    const existing = this.findStreamMessage(input);
    if (existing) {
      const next: Message = {
        ...existing,
        toolEvents: [...(existing.toolEvents ?? []), input.event],
        extra: {
          ...existing.extra,
          stream: {
            ...existing.extra?.stream,
            invocationId: input.invocationId,
            chunkType: "tool_call",
          },
        },
      };
      this.updateContentThinkingToolEventsAndExtra(next);
      return { message: next, created: false };
    }

    const message: Message = {
      id: nanoid(),
      threadId: input.threadId,
      senderType: "agent",
      senderId: input.senderId,
      content: "",
      mentions: [],
      origin: "agent_stream",
      deliveryStatus: "delivered",
      invocationId: input.invocationId,
      toolEvents: [input.event],
      extra: { stream: { invocationId: input.invocationId, chunkType: "tool_call" } },
      createdAt: input.createdAt ?? Date.now(),
    };
    this.create(message);
    return { message, created: true };
  }

  hasCallbackForInvocation(input: { threadId: string; invocationId: string; senderId: string }): boolean {
    return Boolean(this.findCallbackMessage(input));
  }

  listByThread(threadId: string, limit = 100): Message[] {
    const nonStreamRows = this.db
      .prepare(
        `
        SELECT * FROM messages
        WHERE thread_id = ?
          AND COALESCE(origin, '') <> 'agent_stream'
        ORDER BY created_at DESC
        LIMIT ?
      `,
      )
      .all(threadId, limit) as MessageRow[];
    const earliestRegularMessageAt = nonStreamRows.reduce<number | undefined>(
      (min, row) => (min === undefined ? row.created_at : Math.min(min, row.created_at)),
      undefined,
    );
    const streamRows =
      earliestRegularMessageAt === undefined
        ? (this.db
            .prepare(
              `
              SELECT * FROM messages
              WHERE thread_id = ?
                AND origin = 'agent_stream'
              ORDER BY created_at DESC
              LIMIT ?
            `,
            )
            .all(threadId, limit) as MessageRow[])
        : (this.db
            .prepare(
              `
              SELECT * FROM messages
              WHERE thread_id = ?
                AND origin = 'agent_stream'
                AND created_at >= ?
              ORDER BY created_at DESC
            `,
            )
            .all(threadId, earliestRegularMessageAt) as MessageRow[]);
    return [...nonStreamRows, ...streamRows]
      .sort((a, b) => a.created_at - b.created_at)
      .map(toMessage);
  }

  listByInvocation(input: { threadId: string; invocationId: string; senderId?: string; limit?: number }): Message[] {
    const senderClause = input.senderId ? "AND sender_id = ?" : "";
    const params: Array<string | number> = [input.threadId, input.invocationId];
    if (input.senderId) params.push(input.senderId);
    params.push(input.limit ?? 100);
    const rows = this.db
      .prepare(
        `
        SELECT * FROM messages
        WHERE thread_id = ?
          AND invocation_id = ?
          ${senderClause}
        ORDER BY created_at DESC
        LIMIT ?
      `,
      )
      .all(...params) as MessageRow[];
    return rows.reverse().map(toMessage);
  }

  private findStreamMessage(input: { threadId: string; invocationId: string; senderId: string }): Message | null {
    const row = this.db
      .prepare(
        `
        SELECT * FROM messages
        WHERE thread_id = ?
          AND invocation_id = ?
          AND sender_id = ?
          AND origin = 'agent_stream'
        ORDER BY created_at ASC
        LIMIT 1
      `,
      )
      .get(input.threadId, input.invocationId, input.senderId) as MessageRow | undefined;
    return row ? toMessage(row) : null;
  }

  private findCallbackMessage(input: { threadId: string; invocationId: string; senderId: string }): Message | null {
    const row = this.db
      .prepare(
        `
        SELECT * FROM messages
        WHERE thread_id = ?
          AND invocation_id = ?
          AND sender_id = ?
          AND origin = 'callback'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      )
      .get(input.threadId, input.invocationId, input.senderId) as MessageRow | undefined;
    return row ? toMessage(row) : null;
  }

  private appendThinkingToMessage(existing: Message, content: string, mode: "delta" | "snapshot" | "block"): Message {
    const next: Message = {
      ...existing,
      content: "",
      thinking: mergeThinking(existing.thinking, content, mode),
      extra: {
        ...existing.extra,
        stream: {
          ...existing.extra?.stream,
          invocationId: existing.invocationId,
          chunkType: "thinking",
        },
      },
    };
    this.updateContentThinkingToolEventsAndExtra(next);
    return next;
  }

  private updateContentThinkingToolEventsAndExtra(message: Message): void {
    this.db
      .prepare("UPDATE messages SET content = ?, thinking = ?, tool_events_json = ?, extra_json = ? WHERE id = ?")
      .run(
        message.content,
        message.thinking ?? null,
        message.toolEvents ? JSON.stringify(message.toolEvents) : null,
        message.extra ? JSON.stringify(message.extra) : null,
        message.id,
      );
  }
}

function inferOrigin(senderType: SenderType): MessageOrigin {
  if (senderType === "user") return "user";
  if (senderType === "system") return "system";
  return "agent_stream";
}

function mergeThinking(
  existing: string | undefined,
  next: string | undefined,
  mode: "delta" | "snapshot" | "block",
): string | undefined {
  if (!next) return existing;
  if (mode === "snapshot") return next;
  if (mode === "delta") return `${existing ?? ""}${next}`;
  if (!existing) return next;
  if (existing === next) return existing;
  if (next.startsWith(existing)) return next;
  if (existing.startsWith(next)) return existing;
  return `${existing}\n\n${next}`;
}

function appendTextBlock(existing: string, next: string): string {
  if (!existing) return next;
  if (!next) return existing;
  return `${existing}\n${next}`;
}

function parseOptionalJson<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  return JSON.parse(value) as T;
}
