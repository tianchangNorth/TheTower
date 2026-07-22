import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { rehearseA2AIsolationMigration } from "../../src/migration/A2AIsolationMigrationRehearsal.js";

test("migration rehearsal upgrades a backup, is idempotent, and leaves source bytes unchanged", async () => {
  const dir = mkdtempSync(join(tmpdir(), "the-tower-migration-rehearsal-"));
  const sourcePath = join(dir, "historical.db");
  const outputDir = join(dir, "output");
  const source = new Database(sourcePath);
  source.exec(`
    CREATE TABLE threads (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, mode TEXT,
      project_path TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, sender_type TEXT NOT NULL,
      sender_id TEXT, content TEXT NOT NULL, mentions_json TEXT NOT NULL DEFAULT '[]',
      origin TEXT, extra_json TEXT, invocation_id TEXT, reply_to TEXT, created_at INTEGER NOT NULL
    );
    INSERT INTO threads VALUES ('legacy-thread', 'Legacy', 'debug', NULL, 1, 1);
    INSERT INTO messages VALUES (
      'legacy-message', 'legacy-thread', 'agent', 'zavala', 'old final', '[]',
      'agent_final', '{"source":"historical-copy"}', NULL, NULL, 1
    );
  `);
  source.close();
  const before = readFileSync(sourcePath);

  try {
    const report = await rehearseA2AIsolationMigration({ sourcePath, outputDir });
    assert.equal(report.ok, true);
    assert.equal(report.sourceUnchanged, true);
    assert.deepEqual(report.before, { legacyAgentFinalMessages: 1, debugThreads: 1 });
    assert.equal(report.after.legacyAgentFinalMessages, 0);
    assert.equal(report.after.migratedCallbacks, 1);
    assert.equal(report.after.debugThreads, 0);
    assert.deepEqual(report.after.migrationVersions, [1]);
    assert.equal(report.validation.idempotent, true);
    assert.deepEqual(readFileSync(sourcePath), before);

    const migrated = new Database(report.rehearsalPath, { readonly: true });
    const row = migrated.prepare("SELECT origin, extra_json FROM messages WHERE id = 'legacy-message'").get() as {
      origin: string;
      extra_json: string;
    };
    migrated.close();
    assert.equal(row.origin, "callback");
    assert.deepEqual(JSON.parse(row.extra_json), { source: "historical-copy", isExplicitPost: false });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
