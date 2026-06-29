import assert from "node:assert/strict";
import test from "node:test";
import { buildFullTools, EXPLICIT_TOOL_ANNOTATIONS } from "../src/server-toolsets.js";

test("every registered tool has explicit MCP annotations and no dead annotation entries", () => {
  const registered = new Set(buildFullTools({ profile: "full" }).map((tool) => tool.name));
  const missing = [...registered].filter((name) => !EXPLICIT_TOOL_ANNOTATIONS[name]);
  assert.deepEqual(missing, []);

  const dead = Object.keys(EXPLICIT_TOOL_ANNOTATIONS).filter((name) => !registered.has(name));
  assert.deepEqual(dead, []);
});

test("read and write tool annotations match first-version tool semantics", () => {
  for (const name of ["get_thread_context", "read_file", "read_file_slice", "list_files"]) {
    assert.equal(EXPLICIT_TOOL_ANNOTATIONS[name].readOnlyHint, true, `${name} should be read-only`);
    assert.equal(EXPLICIT_TOOL_ANNOTATIONS[name].destructiveHint, false, `${name} should not be destructive`);
    assert.equal(EXPLICIT_TOOL_ANNOTATIONS[name].openWorldHint, false, `${name} should stay local`);
  }

  for (const name of ["post_message", "write_file"]) {
    assert.equal(EXPLICIT_TOOL_ANNOTATIONS[name].readOnlyHint, false, `${name} should be write`);
    assert.equal(EXPLICIT_TOOL_ANNOTATIONS[name].destructiveHint, false, `${name} should be non-destructive write`);
    assert.equal(EXPLICIT_TOOL_ANNOTATIONS[name].openWorldHint, false, `${name} should stay local`);
  }

  assert.equal(EXPLICIT_TOOL_ANNOTATIONS.shell_exec.readOnlyHint, false);
  assert.equal(EXPLICIT_TOOL_ANNOTATIONS.shell_exec.destructiveHint, true);
  assert.equal(EXPLICIT_TOOL_ANNOTATIONS.shell_exec.openWorldHint, false);
});
