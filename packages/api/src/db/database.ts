import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

const defaultDbPath = resolve(process.cwd(), "data", "app.db");

export function openDatabase(path = process.env.APP_DB ?? defaultDbPath): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export const db = openDatabase();
