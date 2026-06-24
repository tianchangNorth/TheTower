import { createHash, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";

interface CallbackTokenRow {
  invocation_id: string;
  token_hash: string;
  expires_at: number;
  active: number;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class CallbackTokenStore {
  constructor(private readonly db: Database.Database) {}

  create(input: { invocationId: string; token: string; expiresAt: number }): void {
    this.db
      .prepare(
        `
        INSERT INTO callback_tokens (invocation_id, token_hash, expires_at, active)
        VALUES (?, ?, ?, 1)
      `,
      )
      .run(input.invocationId, hashToken(input.token), input.expiresAt);
  }

  verify(invocationId: string, token: string, now = Date.now()): boolean {
    const row = this.db
      .prepare("SELECT * FROM callback_tokens WHERE invocation_id = ?")
      .get(invocationId) as CallbackTokenRow | undefined;
    if (!row || row.active !== 1 || row.expires_at <= now) return false;
    const expected = Buffer.from(row.token_hash, "hex");
    const actual = Buffer.from(hashToken(token), "hex");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  deactivate(invocationId: string): void {
    this.db.prepare("UPDATE callback_tokens SET active = 0 WHERE invocation_id = ?").run(invocationId);
  }
}
