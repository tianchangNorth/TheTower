import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFullTools,
  buildWorkspaceTools,
  parseToolsetEnv,
} from "../src/server-toolsets.js";

test("buildFullTools keeps shell execution out of the safe default profile", () => {
  assert.deepEqual(
    buildFullTools({ profile: "full" })
      .map((tool) => tool.name)
      .sort(),
    ["get_thread_context", "list_files", "post_message", "read_file", "read_file_slice", "shell_exec", "write_file"],
  );
  assert.deepEqual(
    buildFullTools({ profile: "workspace-write" })
      .map((tool) => tool.name)
      .sort(),
    ["get_thread_context", "list_files", "post_message", "read_file", "read_file_slice", "write_file"],
  );
  assert.deepEqual(
    buildFullTools({ profile: "collab-only" })
      .map((tool) => tool.name)
      .sort(),
    ["get_thread_context", "post_message"],
  );
  assert.deepEqual(
    buildFullTools({ profile: "read-only" })
      .map((tool) => tool.name)
      .sort(),
    ["get_thread_context", "list_files", "read_file", "read_file_slice"],
  );
});

test("buildWorkspaceTools filters write_file out of read-only profile", () => {
  assert.deepEqual(
    buildWorkspaceTools({ profile: "read-only" })
      .map((tool) => tool.name)
      .sort(),
    ["list_files", "read_file", "read_file_slice"],
  );
});

test("parseToolsetEnv rejects unknown MCP profiles", () => {
  assert.throws(
    () => parseToolsetEnv({ THE_TOWER_MCP_PROFILE: "unsafe" }),
    /Unknown THE_TOWER_MCP_PROFILE/,
  );
});

test("parseToolsetEnv defaults to collaboration-only", () => {
  assert.deepEqual(parseToolsetEnv({}), { profile: "collab-only" });
});
