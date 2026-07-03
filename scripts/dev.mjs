#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const binExt = process.platform === "win32" ? ".cmd" : "";

const targets = {
  mcp: {
    label: "packages/mcp-server",
    cwd: join(rootDir, "packages/mcp-server"),
    command: `./node_modules/.bin/tsc${binExt}`,
    args: ["--watch", "--preserveWatchOutput"],
  },
  api: {
    label: "packages/api",
    cwd: join(rootDir, "packages/api"),
    command: `./node_modules/.bin/tsx${binExt}`,
    args: ["watch", "src/server.ts"],
  },
  web: {
    label: "packages/web",
    cwd: join(rootDir, "packages/web"),
    command: `./node_modules/.bin/next${binExt}`,
    args: ["dev", "-H", "127.0.0.1", "-p", "5173"],
  },
};

const requestedTargets = process.argv.slice(2);
const selectedTargets = requestedTargets.length === 0 ? ["mcp", "api", "web"] : requestedTargets;
const unknownTargets = selectedTargets.filter((target) => !(target in targets));

if (unknownTargets.length > 0) {
  console.error(`Unknown dev target: ${unknownTargets.join(", ")}`);
  console.error(`Available targets: ${Object.keys(targets).join(", ")}`);
  process.exit(1);
}

const children = new Map();
let shuttingDown = false;
let exitTimer;

for (const targetName of selectedTargets) {
  startTarget(targetName, targets[targetName]);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, () => shutdown(signal, 0));
}

process.once("exit", () => {
  if (!shuttingDown) killChildren("SIGTERM");
});

function startTarget(targetName, target) {
  const child = spawn(target.command, target.args, {
    cwd: target.cwd,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  children.set(targetName, child);
  child.stdout?.on("data", createPrefixedWriter(target.label, process.stdout));
  child.stderr?.on("data", createPrefixedWriter(target.label, process.stderr));
  child.once("error", (error) => {
    console.error(`${target.label}: failed to start ${target.command}: ${error.message}`);
    shutdown("SIGTERM", 1);
  });
  child.once("exit", (code, signal) => {
    children.delete(targetName);
    if (shuttingDown) return;

    const status = signal ? `signal ${signal}` : `exit code ${code ?? 0}`;
    console.error(`${target.label}: dev process stopped with ${status}`);
    shutdown("SIGTERM", code === 0 ? 0 : code ?? 1);
  });
}

function shutdown(signal, exitCode) {
  if (shuttingDown) return;

  shuttingDown = true;
  process.exitCode = exitCode;
  killChildren(signal === "SIGINT" ? "SIGTERM" : signal);

  exitTimer = setTimeout(() => {
    killChildren("SIGKILL");
    process.exit(process.exitCode ?? 1);
  }, 4000);
  exitTimer.unref?.();

  if (children.size === 0) {
    process.exit(process.exitCode ?? 0);
  }

  for (const child of children.values()) {
    child.once("exit", () => {
      if (children.size === 0) {
        if (exitTimer) clearTimeout(exitTimer);
        process.exit(process.exitCode ?? 0);
      }
    });
  }
}

function killChildren(signal) {
  for (const child of children.values()) {
    if (child.exitCode !== null || child.signalCode !== null) continue;

    for (const pid of collectProcessTree(child.pid)) {
      try {
        process.kill(pid, signal);
      } catch (error) {
        if (error?.code !== "ESRCH") throw error;
      }
    }
  }
}

function collectProcessTree(rootPid) {
  const childrenByParent = listProcessesByParent();
  const pids = [];
  const stack = [rootPid];

  while (stack.length > 0) {
    const pid = stack.pop();
    if (!pid || pids.includes(pid)) continue;

    pids.push(pid);
    for (const childPid of childrenByParent.get(pid) ?? []) {
      stack.push(childPid);
    }
  }

  return pids.reverse();
}

function listProcessesByParent() {
  if (process.platform === "win32") return new Map();

  const result = spawnSync("ps", ["-axo", "pid=,ppid="], { encoding: "utf8" });
  if (result.status !== 0) return new Map();

  const childrenByParent = new Map();
  for (const line of result.stdout.split(/\r?\n/)) {
    const [pidText, ppidText] = line.trim().split(/\s+/);
    const pid = Number(pidText);
    const ppid = Number(ppidText);
    if (!Number.isInteger(pid) || !Number.isInteger(ppid)) continue;

    const children = childrenByParent.get(ppid) ?? [];
    children.push(pid);
    childrenByParent.set(ppid, children);
  }
  return childrenByParent;
}

function createPrefixedWriter(label, stream) {
  let atLineStart = true;

  return (chunk) => {
    const text = chunk.toString();
    for (const part of text.split(/(\r?\n)/)) {
      if (part === "") continue;
      if (part === "\n" || part === "\r\n") {
        stream.write(part);
        atLineStart = true;
        continue;
      }

      if (atLineStart) stream.write(`${label}: `);
      stream.write(part);
      atLineStart = false;
    }
  };
}
