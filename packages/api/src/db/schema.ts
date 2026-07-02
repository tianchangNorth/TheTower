import type Database from "better-sqlite3";

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      mention_handles_json TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      role_prompt TEXT NOT NULL DEFAULT '',
      persona_json TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'play',
      project_path TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      project_path TEXT NOT NULL UNIQUE,
      trusted_at INTEGER NOT NULL,
      last_opened_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      sender_id TEXT,
      content TEXT NOT NULL,
      mentions_json TEXT NOT NULL DEFAULT '[]',
      visibility TEXT,
      visible_to_agent_ids_json TEXT,
      revealed_at INTEGER,
      origin TEXT,
      delivery_status TEXT,
      handoff_payload_json TEXT,
      extra_json TEXT,
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
      route_mode TEXT,
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

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'todo',
      tags_json TEXT NOT NULL DEFAULT '[]',
      owner_agent_id TEXT,
      project_path TEXT,
      thread_ids_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  ensureColumn(db, "messages", "visibility", "TEXT");
  ensureColumn(db, "messages", "visible_to_agent_ids_json", "TEXT");
  ensureColumn(db, "messages", "revealed_at", "INTEGER");
  ensureColumn(db, "messages", "origin", "TEXT");
  ensureColumn(db, "messages", "delivery_status", "TEXT");
  ensureColumn(db, "messages", "handoff_payload_json", "TEXT");
  ensureColumn(db, "messages", "extra_json", "TEXT");
  ensureColumn(db, "threads", "mode", "TEXT NOT NULL DEFAULT 'play'");
  ensureColumn(db, "threads", "project_path", "TEXT");
  ensureColumn(db, "invocations", "route_mode", "TEXT");
  ensureColumn(db, "agents", "persona_json", "TEXT NOT NULL DEFAULT '{}'");

  runMigrations(db);
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY
    );
  `);

  // v1: A2A 输出隔离结构性升级 —— 消除 agent_final origin，默认 thread mode 改为 play。
  //   - 旧 agent_final 消息迁移为 callback（isExplicitPost=false，标记为历史遗留非主动 post）。
  //   - 现有 thread mode 升级为 play（默认隔离生效）。
  ensureMigration(db, 1, () => {
    const rows = db
      .prepare("SELECT id, extra_json FROM messages WHERE origin = 'agent_final'")
      .all() as Array<{ id: string; extra_json: string | null }>;
    const update = db.prepare(
      "UPDATE messages SET origin = 'callback', extra_json = ? WHERE id = ?",
    );
    const tx = db.transaction(() => {
      for (const row of rows) {
        const extra = row.extra_json ? (JSON.parse(row.extra_json) as Record<string, unknown>) : {};
        extra.isExplicitPost = false;
        update.run(JSON.stringify(extra), row.id);
      }
      db.exec("UPDATE threads SET mode = 'play' WHERE mode IS NULL OR mode = 'debug'");
    });
    tx();
  });
}

function ensureMigration(db: Database.Database, version: number, apply: () => void): void {
  const row = db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get(version);
  if (row) return;
  apply();
  db.prepare("INSERT INTO schema_migrations(version) VALUES (?)").run(version);
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((item) => item.name === column)) return;
  db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}
