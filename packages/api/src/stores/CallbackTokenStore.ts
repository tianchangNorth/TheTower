import { createHash, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";

interface CallbackTokenRow {
  invocation_id: string;
  token_hash: string;
  agent_id: string | null;
  step_id: string | null;
  expires_at: number;
  active: number;
}

export interface AuthenticatedCallbackGrant {
  invocationId: string;
  agentId: string;
  stepId?: string;
  expiresAt: number;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class CallbackTokenStore {
  constructor(private readonly db: Database.Database) {}

  create(input: { invocationId: string; token: string; expiresAt: number; agentId?: string; stepId?: string }): void {
    this.db
      .prepare(
        `
        INSERT INTO callback_tokens (invocation_id, token_hash, agent_id, step_id, expires_at, active)
        VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT(invocation_id) DO UPDATE SET
          token_hash = excluded.token_hash,
          agent_id = excluded.agent_id,
          step_id = excluded.step_id,
          expires_at = excluded.expires_at,
          active = 1
      `,
      )
      .run(input.invocationId, hashToken(input.token), input.agentId ?? null, input.stepId ?? null, input.expiresAt);
  }

  verify(invocationId: string, token: string, agentId?: string, now = Date.now()): boolean {
    const grant = this.authenticate(invocationId, token, now);
    return grant !== null && (agentId === undefined || grant.agentId === agentId);
  }

  authenticate(invocationId: string, token: string, now = Date.now()): AuthenticatedCallbackGrant | null {
    const row = this.db
      .prepare("SELECT * FROM callback_tokens WHERE invocation_id = ?")
      .get(invocationId) as CallbackTokenRow | undefined;
    if (!row || row.active !== 1 || row.expires_at <= now || !row.agent_id) return null;
    const expected = Buffer.from(row.token_hash, "hex");
    const actual = Buffer.from(hashToken(token), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    return {
      invocationId: row.invocation_id,
      agentId: row.agent_id,
      ...(row.step_id ? { stepId: row.step_id } : {}),
      expiresAt: row.expires_at,
    };
  }

  deactivate(invocationId: string): void {
    this.db.prepare("UPDATE callback_tokens SET active = 0 WHERE invocation_id = ?").run(invocationId);
  }
}
