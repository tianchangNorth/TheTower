#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const runtimeDir = mkdtempSync(join(tmpdir(), "the-tower-e2e-"));
const binExt = process.platform === "win32" ? ".cmd" : "";
const apiPort = "33001";
const webPort = "35173";
const children = new Set();
let shuttingDown = false;
const nextEnvPath = join(rootDir, "packages/web/next-env.d.ts");
const originalNextEnv = readFileSync(nextEnvPath);
const webEnv = {
  ...process.env,
  THE_TOWER_API_TARGET: `http://127.0.0.1:${apiPort}`,
  NEXT_PUBLIC_SSE_ORIGIN: `http://127.0.0.1:${apiPort}`,
};

cpSync(join(rootDir, "agent-template.json"), join(runtimeDir, "agent-template.json"));

const webBuild = spawnSync(join(rootDir, "packages/web/node_modules/.bin", `next${binExt}`), ["build"], {
  cwd: join(rootDir, "packages/web"),
  env: webEnv,
  stdio: "inherit",
});
if (webBuild.status !== 0) {
  cleanup();
  process.exit(webBuild.status ?? 1);
}

start({
  label: "api",
  cwd: join(rootDir, "packages/api"),
  command: process.execPath,
  args: ["dist/server.js"],
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: apiPort,
    APP_DB: join(runtimeDir, "app.db"),
    PROJECT_ROOT: runtimeDir,
    AGENT_TEMPLATE_PATH: join(runtimeDir, "agent-template.json"),
    THE_TOWER_PROJECT_ALLOWED_ROOTS: rootDir,
    THE_TOWER_ALLOWED_ORIGINS: `http://127.0.0.1:${webPort}`,
  },
});

start({
  label: "web",
  cwd: join(rootDir, "packages/web"),
  command: join(rootDir, "packages/web/node_modules/.bin", `next${binExt}`),
  args: ["start", "-H", "127.0.0.1", "-p", webPort],
  env: webEnv,
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, () => shutdown(signal, 0));
}

process.once("exit", cleanup);

function start(options) {
  const child = spawn(options.command, options.args, {
    cwd: options.cwd,
    env: options.env,
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  children.add(child);
  child.once("error", (error) => {
    console.error(`${options.label}: ${error.message}`);
    shutdown("SIGTERM", 1);
  });
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (shuttingDown) {
      if (children.size === 0) process.exit(process.exitCode ?? 0);
      return;
    }
    console.error(`${options.label}: exited unexpectedly (${signal ?? code ?? 0})`);
    shutdown("SIGTERM", code === 0 ? 1 : code ?? 1);
  });
}

function shutdown(signal, exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;

  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    try {
      process.kill(process.platform === "win32" ? child.pid : -child.pid, signal === "SIGINT" ? "SIGTERM" : signal);
    } catch (error) {
      if (error?.code !== "ESRCH") console.error(error);
    }
  }

  if (children.size === 0) process.exit(exitCode);
  const forceTimer = setTimeout(() => {
    for (const child of children) {
      if (!child.pid || child.exitCode !== null) continue;
      try {
        process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGKILL");
      } catch (error) {
        if (error?.code !== "ESRCH") console.error(error);
      }
    }
    process.exit(exitCode || 1);
  }, 5_000);
  forceTimer.unref();
}

function cleanup() {
  writeFileSync(nextEnvPath, originalNextEnv);
  rmSync(runtimeDir, { recursive: true, force: true });
}
