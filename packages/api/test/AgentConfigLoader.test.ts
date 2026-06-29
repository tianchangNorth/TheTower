import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  bootstrapAgentCatalog,
  loadAgentCatalog,
  migrateLegacyRolePrompt,
  normalizeAgentModel,
  resolveAgentCatalogPath,
  saveAgentCatalog,
  updateAgentInCatalog,
} from "../src/config/AgentConfigLoader.js";
import type { Agent } from "../src/types.js";

test("bootstrapAgentCatalog copies agent-template into runtime catalog", async () => {
  const root = await makeProjectRoot();

  const catalogPath = bootstrapAgentCatalog(root);
  const catalog = loadAgentCatalog(root);

  assert.equal(catalogPath, resolveAgentCatalogPath(root));
  assert.deepEqual(
    catalog.agents.map((agent) => agent.id),
    ["agent-a", "agent-b"],
  );
  assert.match(await readFile(catalogPath, "utf8"), /agent-a/);
});

test("loadAgentCatalog migrates legacy rolePrompt into persona and rewrites disk", async () => {
  const root = await makeProjectRoot();
  bootstrapAgentCatalog(root);
  const catalog = loadAgentCatalog(root);

  // 迁移后 persona 非空且磁盘上不再有 rolePrompt。
  assert.ok(catalog.agents[0]?.persona.roleDescription);
  assert.ok(catalog.agents[0]?.persona.personality);
  assert.doesNotMatch(await readFile(resolveAgentCatalogPath(root), "utf8"), /rolePrompt/);
});

test("migrateLegacyRolePrompt splits the standard legacy format", () => {
  const persona = migrateLegacyRolePrompt(
    "你是 TheTower 平台中的 Ikora Rey。你负责深度调研、方案推演。你的回复要注重证据、推理链路和可验证结论。",
  );
  assert.equal(persona.roleDescription, "深度调研、方案推演");
  assert.equal(persona.personality, "注重证据、推理链路和可验证结论");
  assert.deepEqual(persona.strengths, []);
});

test("migrateLegacyRolePrompt falls back to whole prompt when format is non-standard", () => {
  const persona = migrateLegacyRolePrompt("Architect");
  assert.equal(persona.roleDescription, "Architect");
  assert.ok(persona.personality.length > 0);
});

test("saveAgentCatalog rejects duplicate mention handles", async () => {
  const root = await makeProjectRoot();
  bootstrapAgentCatalog(root);
  const catalog = loadAgentCatalog(root);

  assert.throws(
    () =>
      saveAgentCatalog(
        {
          ...catalog,
          agents: catalog.agents.map((agent, index) =>
            index === 1 ? { ...agent, mentionHandles: ["@agent-a"] } : agent,
          ),
        },
        root,
      ),
    /already used/,
  );
});

test("updateAgentInCatalog persists one agent update", async () => {
  const root = await makeProjectRoot();
  bootstrapAgentCatalog(root);
  const catalog = loadAgentCatalog(root);
  const updated: Agent = {
    ...catalog.agents[0]!,
    provider: "codex",
    model: "mock-architect",
  };

  updateAgentInCatalog(updated, root);
  const next = loadAgentCatalog(root);

  assert.equal(next.agents[0]?.provider, "codex");
  assert.equal(next.agents[0]?.model, "gpt-5");
});

test("normalizeAgentModel maps mock model names away from real CLI providers", () => {
  assert.equal(normalizeAgentModel("codex", "mock-reviewer"), "gpt-5");
  assert.equal(normalizeAgentModel("claude", "mock-reviewer"), "sonnet");
  assert.equal(normalizeAgentModel("mock", "mock-reviewer"), "mock-reviewer");
});

async function makeProjectRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "the-tower-agent-config-"));
  await writeFile(
    join(root, "agent-template.json"),
    JSON.stringify({
      version: 1,
      agents: [
        {
          id: "agent-a",
          displayName: "Agent A",
          mentionHandles: ["@agent-a"],
          provider: "mock",
          model: "mock-architect",
          rolePrompt: "Architect",
          enabled: true,
        },
        {
          id: "agent-b",
          displayName: "Agent B",
          mentionHandles: ["@agent-b"],
          provider: "mock",
          model: "mock-reviewer",
          rolePrompt: "Reviewer",
          enabled: true,
        },
      ],
    }),
  );
  return root;
}
