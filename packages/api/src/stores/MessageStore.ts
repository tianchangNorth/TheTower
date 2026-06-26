import type Database from "better-sqlite3";
import type {
  HandoffPayload,
  Message,
  MessageDeliveryStatus,
  MessageOrigin,
  MessageVisibility,
  SenderType,
} from "../types.js";

interface MessageRow {
  id: string;
  thread_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  content: string;
  mentions_json: string;
  visibility: MessageVisibility | null;
  visible_to_agent_ids_json: string | null;
  revealed_at: number | null;
  origin: MessageOrigin | null;
  delivery_status: MessageDeliveryStatus | null;
  handoff_payload_json: string | null;
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
    mentions: JSON.parse(row.mentions_json) as string[],
    visibility: row.visibility ?? "public",
    visibleToAgentIds: parseOptionalJson<string[]>(row.visible_to_agent_ids_json),
    revealedAt: row.revealed_at ?? undefined,
    origin: row.origin ?? inferOrigin(row.sender_type),
    deliveryStatus: row.delivery_status ?? "delivered",
    handoffPayload: parseOptionalJson<HandoffPayload>(row.handoff_payload_json),
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
          mentions_json,
          visibility,
          visible_to_agent_ids_json,
          revealed_at,
          origin,
          delivery_status,
          handoff_payload_json,
          invocation_id,
          reply_to,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        message.id,
        message.threadId,
        message.senderType,
        message.senderId ?? null,
        message.content,
        JSON.stringify(message.mentions),
        message.visibility ?? "public",
        message.visibleToAgentIds ? JSON.stringify(message.visibleToAgentIds) : null,
        message.revealedAt ?? null,
        message.origin ?? inferOrigin(message.senderType),
        message.deliveryStatus ?? "delivered",
        message.handoffPayload ? JSON.stringify(message.handoffPayload) : null,
        message.invocationId ?? null,
        message.replyTo ?? null,
        message.createdAt,
      );
  }

  get(id: string): Message | null {
    const row = this.db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as MessageRow | undefined;
    return row ? toMessage(row) : null;
  }

  listByThread(threadId: string, limit = 100): Message[] {
    const rows = this.db
      .prepare(
        `
        SELECT * FROM messages
        WHERE thread_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
      )
      .all(threadId, limit) as MessageRow[];
    return rows.reverse().map(toMessage);
  }
}

function inferOrigin(senderType: SenderType): MessageOrigin {
  if (senderType === "user") return "user";
  if (senderType === "system") return "system";
  return "agent_final";
}

function parseOptionalJson<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  return JSON.parse(value) as T;
}
