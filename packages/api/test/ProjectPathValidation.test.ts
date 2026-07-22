import assert from "node:assert/strict";
import { mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateProjectPathDetailed } from "../src/workspaces/projectPath.js";

test("validateProjectPathDetailed accepts existing directories under allowed roots", async () => {
  const root = await mkdtemp(join(tmpdir(), "tower-root-"));
  const project = await mkdtemp(join(root, "project-"));
  const previous = process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS;
  process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS = await realpath(root);
  try {
    const result = await validateProjectPathDetailed(project);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.path, await realpath(project));
  } finally {
    if (previous === undefined) delete process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS;
    else process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test("validateProjectPathDetailed canonicalizes a symlinked allowed root", async () => {
  const container = await mkdtemp(join(tmpdir(), "tower-root-alias-"));
  const realRoot = await mkdtemp(join(container, "real-"));
  const project = await mkdtemp(join(realRoot, "project-"));
  const rootAlias = join(container, "allowed-root-alias");
  await symlink(realRoot, rootAlias);
  const previous = process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS;
  process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS = rootAlias;
  try {
    const result = await validateProjectPathDetailed(project);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.path, await realpath(project));
  } finally {
    if (previous === undefined) delete process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS;
    else process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS = previous;
    await rm(container, { recursive: true, force: true });
  }
});

test("validateProjectPathDetailed rejects files and paths outside allowed roots", async () => {
  const allowedRoot = await mkdtemp(join(tmpdir(), "tower-allowed-"));
  const outsideRoot = await mkdtemp(join(tmpdir(), "tower-outside-"));
  const filePath = join(allowedRoot, "file.txt");
  await writeFile(filePath, "x");
  const previous = process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS;
  process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS = await realpath(allowedRoot);
  try {
    assert.equal((await validateProjectPathDetailed(filePath)).ok, false);
    const outside = await validateProjectPathDetailed(outsideRoot);
    assert.deepEqual(outside.ok ? undefined : outside.reason, "outside_allowed_roots");
  } finally {
    if (previous === undefined) delete process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS;
    else process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS = previous;
    await rm(allowedRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  }
});

test("validateProjectPathDetailed rejects symlink escapes", async () => {
  const allowedRoot = await mkdtemp(join(tmpdir(), "tower-allowed-"));
  const outsideRoot = await mkdtemp(join(tmpdir(), "tower-outside-"));
  const linkPath = join(allowedRoot, "escape");
  await symlink(outsideRoot, linkPath);
  const previous = process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS;
  process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS = await realpath(allowedRoot);
  try {
    const result = await validateProjectPathDetailed(linkPath);
    assert.deepEqual(result.ok ? undefined : result.reason, "outside_allowed_roots");
  } finally {
    if (previous === undefined) delete process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS;
    else process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS = previous;
    await rm(allowedRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  }
});
