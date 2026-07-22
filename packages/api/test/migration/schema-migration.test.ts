import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { initSchema } from "../../src/db/schema.js";

test("historical agent_final data migrates once and remains readable", () => {
  const db = new Database(":memory:");
  try {
    db.exec(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        mode TEXT,
        project_path TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        sender_type TEXT NOT NULL,
        sender_id TEXT,
        content TEXT NOT NULL,
        mentions_json TEXT NOT NULL DEFAULT '[]',
        origin TEXT,
        extra_json TEXT,
        invocation_id TEXT,
        reply_to TEXT,
        created_at INTEGER NOT NULL
      );

      INSERT INTO threads(id, title, mode, created_at, updated_at)
      VALUES ('thread-legacy', 'Legacy thread', 'debug', 1, 1);

      INSERT INTO messages(
        id, thread_id, sender_type, sender_id, content,
        mentions_json, origin, extra_json, created_at
      ) VALUES (
        'message-legacy', 'thread-legacy', 'agent', 'zavala', 'legacy result',
        '[]', 'agent_final', '{"source":"fixture"}', 1
      );
    `);

    initSchema(db);
    initSchema(db);

    const message = db.prepare("SELECT origin, extra_json FROM messages WHERE id = ?").get("message-legacy") as {
      origin: string;
      extra_json: string;
    };
    const thread = db.prepare("SELECT mode FROM threads WHERE id = ?").get("thread-legacy") as { mode: string };
    const migrations = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: number }>;

    assert.equal(message.origin, "callback");
    assert.deepEqual(JSON.parse(message.extra_json), { source: "fixture", isExplicitPost: false });
    assert.equal(thread.mode, "play");
    assert.deepEqual(migrations, [{ version: 1 }]);
  } finally {
    db.close();
  }
});
