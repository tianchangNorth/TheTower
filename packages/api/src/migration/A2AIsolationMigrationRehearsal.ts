import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { initSchema } from "../db/schema.js";

export interface A2AIsolationMigrationRehearsalReport {
  generatedAt: string;
  sourcePath: string;
  rehearsalPath: string;
  sourceUnchanged: boolean;
  before: { legacyAgentFinalMessages: number; debugThreads: number };
  after: { legacyAgentFinalMessages: number; migratedCallbacks: number; debugThreads: number; migrationVersions: number[] };
  validation: { migratedMessageIds: string[]; invalidMessageIds: string[]; invalidThreadIds: string[]; idempotent: boolean };
  ok: boolean;
}

export async function rehearseA2AIsolationMigration(input: {
  sourcePath: string;
  outputDir: string;
}): Promise<A2AIsolationMigrationRehearsalReport> {
  const sourcePath = resolve(input.sourcePath);
  const outputDir = resolve(input.outputDir);
  mkdirSync(outputDir, { recursive: true });
  const rehearsalPath = join(outputDir, `${basename(sourcePath)}.a2a-rehearsal-${Date.now()}.sqlite`);
  const sourceBefore = fingerprint(sourcePath);
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  const legacyMessageIds = selectIds(source, "messages", "origin = 'agent_final'");
  const debugThreadIds = selectIds(source, "threads", "mode = 'debug'");
  try {
    await source.backup(rehearsalPath);
  } finally {
    source.close();
  }

  const rehearsal = new Database(rehearsalPath);
  let afterFirst = "";
  let afterSecond = "";
  let invalidMessageIds: string[] = [];
  let invalidThreadIds: string[] = [];
  let after!: A2AIsolationMigrationRehearsalReport["after"];
  try {
    initSchema(rehearsal);
    afterFirst = migrationState(rehearsal);
    initSchema(rehearsal);
    afterSecond = migrationState(rehearsal);
    invalidMessageIds = legacyMessageIds.filter((id) => !isMigratedCallback(rehearsal, id));
    invalidThreadIds = debugThreadIds.filter((id) => !isPlayThread(rehearsal, id));
    after = {
      legacyAgentFinalMessages: count(rehearsal, "messages", "origin = 'agent_final'"),
      migratedCallbacks: legacyMessageIds.length - invalidMessageIds.length,
      debugThreads: count(rehearsal, "threads", "mode = 'debug'"),
      migrationVersions: (rehearsal.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: number }>).map(
        (row) => row.version,
      ),
    };
  } finally {
    rehearsal.close();
  }

  const sourceUnchanged = fingerprint(sourcePath) === sourceBefore;
  const idempotent = afterFirst === afterSecond;
  const ok =
    sourceUnchanged &&
    invalidMessageIds.length === 0 &&
    invalidThreadIds.length === 0 &&
    after.legacyAgentFinalMessages === 0 &&
    after.debugThreads === 0 &&
    idempotent;
  return {
    generatedAt: new Date().toISOString(),
    sourcePath,
    rehearsalPath,
    sourceUnchanged,
    before: { legacyAgentFinalMessages: legacyMessageIds.length, debugThreads: debugThreadIds.length },
    after,
    validation: { migratedMessageIds: legacyMessageIds, invalidMessageIds, invalidThreadIds, idempotent },
    ok,
  };
}

function selectIds(db: Database.Database, table: string, where: string): string[] {
  if (!tableExists(db, table) || !columnExists(db, table, where.split(" ")[0] ?? "")) return [];
  return (db.prepare(`SELECT id FROM ${table} WHERE ${where} ORDER BY id`).all() as Array<{ id: string }>).map((row) => row.id);
}

function count(db: Database.Database, table: string, where: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get() as { count: number };
  return row.count;
}

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some((row) => row.name === column);
}

function isMigratedCallback(db: Database.Database, id: string): boolean {
  const row = db.prepare("SELECT origin, extra_json FROM messages WHERE id = ?").get(id) as
    | { origin: string; extra_json: string | null }
    | undefined;
  if (!row || row.origin !== "callback" || !row.extra_json) return false;
  try {
    return (JSON.parse(row.extra_json) as { isExplicitPost?: unknown }).isExplicitPost === false;
  } catch {
    return false;
  }
}

function isPlayThread(db: Database.Database, id: string): boolean {
  return (db.prepare("SELECT mode FROM threads WHERE id = ?").get(id) as { mode?: string } | undefined)?.mode === "play";
}

function migrationState(db: Database.Database): string {
  const messages = db.prepare("SELECT id, origin, extra_json FROM messages ORDER BY id").all();
  const threads = db.prepare("SELECT id, mode FROM threads ORDER BY id").all();
  const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
  return JSON.stringify({ messages, threads, versions });
}

function fingerprint(path: string): string {
  const stat = statSync(path);
  return createHash("sha256")
    .update(readFileSync(path))
    .update(String(stat.size))
    .digest("hex");
}
