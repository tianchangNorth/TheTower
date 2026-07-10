import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  getPathBoundaryRefusalReason,
  getShellExecRefusalReason,
  handleShellExec,
  isAllowedShellCommand,
} from "../src/tools/shell-tools.js";

test("shell whitelist allows diagnostics but not script runtimes", () => {
  assert.equal(isAllowedShellCommand("pwd"), true);
  assert.equal(isAllowedShellCommand("ls -la"), true);
  assert.equal(isAllowedShellCommand("cat README.md"), true);
  assert.equal(isAllowedShellCommand("git status --short"), true);
  assert.equal(isAllowedShellCommand("git diff"), true);
  assert.equal(isAllowedShellCommand("git show HEAD"), true);
  assert.equal(isAllowedShellCommand("python3 scripts/check.py"), false);
  assert.equal(isAllowedShellCommand("node scripts/check.js"), false);
});

test("shell whitelist refuses mutating commands and shell expansion", () => {
  assert.equal(isAllowedShellCommand("rm file.txt"), false);
  assert.equal(isAllowedShellCommand("mkdir out"), false);
  assert.equal(isAllowedShellCommand("git commit -m x"), false);
  assert.equal(isAllowedShellCommand("ls | wc -l"), false);
  assert.equal(isAllowedShellCommand("cat $HOME/.ssh/id_rsa"), false);
  assert.equal(isAllowedShellCommand("cat *"), false);
  assert.match(getShellExecRefusalReason("rm -rf /"), /rm -rf/);
});

test("handleShellExec runs locally inside ALLOWED_WORKSPACE_DIRS", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "tower-mcp-shell-"));
  const previous = process.env.ALLOWED_WORKSPACE_DIRS;
  process.env.ALLOWED_WORKSPACE_DIRS = workspace;
  try {
    const pwd = await handleShellExec({ commandLine: "pwd" });
    assert.equal(pwd.isError, undefined);
    assert.match(pwd.content[0].text, /Status: success/);
    assert.match(pwd.content[0].text, new RegExp(workspace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const node = await handleShellExec({ commandLine: "node hello.js" });
    assert.equal(node.isError, true);
    assert.match(node.content[0].text, /not on the whitelist/);
  } finally {
    if (previous === undefined) delete process.env.ALLOWED_WORKSPACE_DIRS;
    else process.env.ALLOWED_WORKSPACE_DIRS = previous;
    await rm(workspace, { recursive: true, force: true });
  }
});

test("handleShellExec refuses cwd and path args outside ALLOWED_WORKSPACE_DIRS", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "tower-mcp-shell-"));
  const outside = await mkdtemp(join(tmpdir(), "tower-mcp-shell-outside-"));
  const previous = process.env.ALLOWED_WORKSPACE_DIRS;
  process.env.ALLOWED_WORKSPACE_DIRS = workspace;
  try {
    const cwdRefused = await handleShellExec({ commandLine: "pwd", cwd: outside });
    assert.equal(cwdRefused.isError, true);
    assert.match(cwdRefused.content[0].text, /cwd outside allowed roots/);

    const pathRefusal = getPathBoundaryRefusalReason(`cat ${join(outside, "outside.js")}`, workspace);
    assert.match(pathRefusal ?? "", /outside allowed roots/);
    const runRefused = await handleShellExec({ commandLine: `cat ${join(outside, "outside.js")}` });
    assert.equal(runRefused.isError, true);
    assert.match(runRefused.content[0].text, /outside allowed roots/);
  } finally {
    if (previous === undefined) delete process.env.ALLOWED_WORKSPACE_DIRS;
    else process.env.ALLOWED_WORKSPACE_DIRS = previous;
    await rm(workspace, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
