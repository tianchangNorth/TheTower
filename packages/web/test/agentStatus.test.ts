import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTokenUsage } from "../src/lib/agentStatus";

test("formatTokenUsage displays current context usage when provider supplies it", () => {
  assert.equal(
    formatTokenUsage({
      inputTokens: 445_300,
      outputTokens: 5_900,
      contextUsedTokens: 42_000,
      contextWindowSize: 128_000,
      source: "provider",
    }),
    "Context 42.0k / 128.0k",
  );
});

test("formatTokenUsage does not fall back to cumulative input/output counters", () => {
  assert.equal(
    formatTokenUsage({
      inputTokens: 445_300,
      outputTokens: 5_900,
      isCumulativeUsage: true,
      source: "provider",
    }),
    "Context --",
  );
});
