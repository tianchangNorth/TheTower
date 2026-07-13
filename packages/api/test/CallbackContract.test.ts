import assert from "node:assert/strict";
import test from "node:test";
import { postAgentMessageInputShape } from "@the-tower/shared";
import { postMessageInputSchema as mcpPostMessageInputSchema } from "@the-tower/mcp-server";
import { callbackPostMessageSchema } from "../src/routes.js";

test("callback fields share one canonical schema across HTTP and MCP", () => {
  assert.equal(mcpPostMessageInputSchema, postAgentMessageInputShape);

  for (const [field, schema] of Object.entries(postAgentMessageInputShape)) {
    assert.equal(callbackPostMessageSchema.shape[field], schema, `HTTP callback field drifted: ${field}`);
  }

  assert.deepEqual(Object.keys(mcpPostMessageInputSchema).sort(), Object.keys(postAgentMessageInputShape).sort());
});
