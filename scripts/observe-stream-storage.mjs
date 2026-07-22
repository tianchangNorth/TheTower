#!/usr/bin/env node

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const args = parseArgs(process.argv.slice(2));
if (!args.db) fail("Usage: pnpm observe:streams -- --db <app.db> [--output <report.json>] [--max-bytes <bytes>] [--max-rows <count>]");
const requireFromApi = createRequire(resolve(rootDir, "packages/api/package.json"));
const Database = requireFromApi("better-sqlite3");
const moduleUrl = pathToFileURL(resolve(rootDir, "packages/api/dist/observability/StreamStorageReport.js")).href;
const { observeStreamStorage } = await import(moduleUrl);
const db = new Database(resolve(args.db), { readonly: true, fileMustExist: true });
try {
  const report = observeStreamStorage(db, {
    maxPayloadBytesPerInvocationAgent: numberArg(args.maxBytes),
    maxRowsPerInvocationAgent: numberArg(args.maxRows),
  });
  if (args.output) {
    const outputPath = resolve(args.output);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.breaches.length > 0) process.exitCode = 2;
} finally {
  db.close();
}

function parseArgs(values) {
  const result = {};
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === "--db") result.db = values[++i];
    else if (value === "--max-bytes") result.maxBytes = values[++i];
    else if (value === "--max-rows") result.maxRows = values[++i];
    else if (value === "--output") result.output = values[++i];
  }
  return result;
}

function numberArg(value) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) fail(`Invalid positive number: ${value}`);
  return parsed;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
