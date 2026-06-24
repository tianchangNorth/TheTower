import assert from "node:assert/strict";
import test from "node:test";
import { shouldRouteAgentText } from "../src/routing/A2ARoutingPolicy.js";

test("shouldRouteAgentText skips acknowledgement-only messages", () => {
  assert.equal(shouldRouteAgentText("@agent-a 收到。"), false);
  assert.equal(shouldRouteAgentText("@agent-b 收到，诗已完成。"), false);
  assert.equal(shouldRouteAgentText("@agent-a @agent-b ok"), false);
});

test("shouldRouteAgentText keeps actionable handoff messages", () => {
  assert.equal(shouldRouteAgentText("@agent-b 请写一首诗，主题自由发挥。"), true);
  assert.equal(shouldRouteAgentText("@agent-c 帮我 review 数据库设计。"), true);
});
