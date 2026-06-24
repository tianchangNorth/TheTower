import type Database from "better-sqlite3";

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      mention_handles_json TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      role_prompt TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      sender_id TEXT,
      content TEXT NOT NULL,
      mentions_json TEXT NOT NULL DEFAULT '[]',
      invocation_id TEXT,
      reply_to TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(thread_id) REFERENCES threads(id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_thread_created
      ON messages(thread_id, created_at);

    CREATE TABLE IF NOT EXISTS invocations (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      root_message_id TEXT NOT NULL,
      status TEXT NOT NULL,
      target_agents_json TEXT NOT NULL,
      depth INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      finished_at INTEGER,
      FOREIGN KEY(thread_id) REFERENCES threads(id),
      FOREIGN KEY(root_message_id) REFERENCES messages(id)
    );

    CREATE INDEX IF NOT EXISTS idx_invocations_thread_created
      ON invocations(thread_id, created_at);

    CREATE TABLE IF NOT EXISTS callback_tokens (
      invocation_id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY(invocation_id) REFERENCES invocations(id)
    );
  `);
}
