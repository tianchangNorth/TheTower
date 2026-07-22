import assert from "node:assert/strict";
import test from "node:test";
import {
  callbackListFilesRequestSchema,
  callbackReadFileRequestSchema,
  callbackReadFileSliceRequestSchema,
  callbackThreadContextRequestSchema,
  callbackWriteFileRequestSchema,
  getThreadContextInputShape,
  listFilesInputShape,
  postAgentMessageInputShape,
  readFileInputShape,
  readFileSliceInputShape,
  writeFileInputShape,
  towerErrorResponseSchema,
  towerErrorCodes,
} from "@the-tower/shared";
import {
  getThreadContextInputSchema as mcpGetThreadContextInputSchema,
  listFilesInputSchema as mcpListFilesInputSchema,
  postMessageInputSchema as mcpPostMessageInputSchema,
  readFileInputSchema as mcpReadFileInputSchema,
  readFileSliceInputSchema as mcpReadFileSliceInputSchema,
  writeFileInputSchema as mcpWriteFileInputSchema,
} from "@the-tower/mcp-server";
import {
  callbackContextSchema,
  callbackListFilesSchema,
  callbackPostMessageSchema,
  callbackReadFileSchema,
  callbackReadFileSliceSchema,
  callbackWriteFileSchema,
} from "../src/routes.js";

test("callback fields share one canonical schema across HTTP and MCP", () => {
  assert.equal(mcpPostMessageInputSchema, postAgentMessageInputShape);

  for (const [field, schema] of Object.entries(postAgentMessageInputShape)) {
    assert.equal(callbackPostMessageSchema.shape[field], schema, `HTTP callback field drifted: ${field}`);
  }

  assert.deepEqual(Object.keys(mcpPostMessageInputSchema).sort(), Object.keys(postAgentMessageInputShape).sort());
});

test("context and file tools share canonical contracts across HTTP and MCP", () => {
  assert.equal(callbackContextSchema, callbackThreadContextRequestSchema);
  assert.equal(callbackReadFileSchema, callbackReadFileRequestSchema);
  assert.equal(callbackReadFileSliceSchema, callbackReadFileSliceRequestSchema);
  assert.equal(callbackListFilesSchema, callbackListFilesRequestSchema);
  assert.equal(callbackWriteFileSchema, callbackWriteFileRequestSchema);

  assert.equal(mcpGetThreadContextInputSchema, getThreadContextInputShape);
  assert.equal(mcpReadFileInputSchema, readFileInputShape);
  assert.equal(mcpReadFileSliceInputSchema, readFileSliceInputShape);
  assert.equal(mcpListFilesInputSchema, listFilesInputShape);
  assert.equal(mcpWriteFileInputSchema, writeFileInputShape);
});

test("stable service error codes are defined by the shared contract", () => {
  for (const code of ["private_recipient_required", "unknown_agent", "unsupported_route_mode"] as const) {
    assert.equal(towerErrorCodes.includes(code), true);
    assert.deepEqual(
      towerErrorResponseSchema.parse({ error: "human-readable message", code, details: { carrier: "test" } }),
      { error: "human-readable message", code, details: { carrier: "test" } },
    );
  }
});
