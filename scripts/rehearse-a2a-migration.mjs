#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const args = parseArgs(process.argv.slice(2));
if (!args.db || !args.output) {
  fail("Usage: pnpm rehearse:migration -- --db <app.db> --output <directory>");
}
const outputDir = resolve(args.output);
mkdirSync(outputDir, { recursive: true });
const moduleUrl = pathToFileURL(resolve(rootDir, "packages/api/dist/migration/A2AIsolationMigrationRehearsal.js")).href;
const { rehearseA2AIsolationMigration } = await import(moduleUrl);
const report = await rehearseA2AIsolationMigration({ sourcePath: resolve(args.db), outputDir });
const reportPath = resolve(outputDir, "a2a-migration-rehearsal-report.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ...report, reportPath }, null, 2)}\n`);
if (!report.ok) process.exitCode = 2;

function parseArgs(values) {
  const result = {};
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === "--db") result.db = values[++i];
    else if (values[i] === "--output") result.output = values[++i];
  }
  return result;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
