import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { z } from "zod";
import type { Agent, AgentProvider } from "../types.js";

export interface AgentCatalog {
  version: 1;
  agents: Agent[];
}

const CONFIG_DIR = ".the-tower";
const CATALOG_FILENAME = "agent-catalog.json";

const agentProviderSchema = z.enum(["codex", "claude", "gemini", "openai-api", "custom", "mock"]);

const agentSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  mentionHandles: z.array(z.string().min(2).regex(/^@/, "mention handle must start with @")).min(1),
  provider: agentProviderSchema,
  model: z.string().min(1),
  rolePrompt: z.string(),
  enabled: z.boolean(),
  createdAt: z.number().int().positive().optional(),
});

const catalogSchema = z.object({
  version: z.literal(1),
  agents: z.array(agentSchema).min(1),
});

type RawAgent = z.infer<typeof agentSchema>;

export function resolveProjectRoot(): string {
  return resolve(process.env.PROJECT_ROOT ?? resolve(process.cwd(), "../.."));
}

export function resolveAgentTemplatePath(projectRoot = resolveProjectRoot()): string {
  return resolve(process.env.AGENT_TEMPLATE_PATH ?? resolve(projectRoot, "agent-template.json"));
}

export function resolveAgentCatalogPath(projectRoot = resolveProjectRoot()): string {
  return safePath(projectRoot, CONFIG_DIR, CATALOG_FILENAME);
}

export function bootstrapAgentCatalog(projectRoot = resolveProjectRoot()): string {
  const catalogPath = resolveAgentCatalogPath(projectRoot);
  if (existsSync(catalogPath)) {
    loadAgentCatalog(projectRoot);
    return catalogPath;
  }

  const template = readAndValidateCatalog(resolveAgentTemplatePath(projectRoot));
  mkdirSync(dirname(catalogPath), { recursive: true });
  writeFileAtomic(catalogPath, `${JSON.stringify(template, null, 2)}\n`);
  return catalogPath;
}

export function loadAgentCatalog(projectRoot = resolveProjectRoot()): AgentCatalog {
  const catalogPath = resolveAgentCatalogPath(projectRoot);
  if (!existsSync(catalogPath)) bootstrapAgentCatalog(projectRoot);
  return readAndValidateCatalog(catalogPath);
}

export function saveAgentCatalog(catalog: AgentCatalog, projectRoot = resolveProjectRoot()): AgentCatalog {
  validateUniqueAgentConfig(catalog.agents);
  const catalogPath = resolveAgentCatalogPath(projectRoot);
  mkdirSync(dirname(catalogPath), { recursive: true });
  const normalized = normalizeCatalog(catalog);
  writeFileAtomic(catalogPath, `${JSON.stringify(normalized, null, 2)}\n`);
  return loadAgentCatalog(projectRoot);
}

export function updateAgentInCatalog(agent: Agent, projectRoot = resolveProjectRoot()): AgentCatalog {
  const catalog = loadAgentCatalog(projectRoot);
  const agents = catalog.agents.map((item) => (item.id === agent.id ? agent : item));
  if (!agents.some((item) => item.id === agent.id)) agents.push(agent);
  return saveAgentCatalog({ ...catalog, agents }, projectRoot);
}

export function normalizeAgentModel(provider: AgentProvider, model: string): string {
  if (provider === "codex" && model.startsWith("mock-")) return process.env.CODEX_AGENT_MODEL ?? "gpt-5";
  if (provider === "claude" && model.startsWith("mock-")) return process.env.CLAUDE_AGENT_MODEL ?? "sonnet";
  return model;
}

function readAndValidateCatalog(filePath: string): AgentCatalog {
  const raw = readFileSync(filePath, "utf8");
  const parsed = catalogSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid agent catalog at ${filePath}\n${details}`);
  }
  return normalizeCatalog({
    version: parsed.data.version,
    agents: parsed.data.agents.map(toAgent),
  });
}

function normalizeCatalog(catalog: AgentCatalog): AgentCatalog {
  const now = Date.now();
  const agents = catalog.agents.map((agent, index) => ({
    ...agent,
    mentionHandles: normalizeMentionHandles(agent.mentionHandles),
    model: normalizeAgentModel(agent.provider, agent.model),
    createdAt: agent.createdAt ?? now + index,
  }));
  validateUniqueAgentConfig(agents);
  return { version: 1, agents };
}

function toAgent(input: RawAgent): Agent {
  return {
    ...input,
    model: normalizeAgentModel(input.provider, input.model),
    createdAt: input.createdAt ?? Date.now(),
  };
}

function normalizeMentionHandles(handles: string[]): string[] {
  return [...new Set(handles.map((handle) => handle.trim()).filter(Boolean))];
}

function validateUniqueAgentConfig(agents: Agent[]): void {
  const ids = new Set<string>();
  const handles = new Map<string, string>();
  for (const agent of agents) {
    if (ids.has(agent.id)) throw new Error(`duplicate agent id "${agent.id}"`);
    ids.add(agent.id);
    for (const handle of agent.mentionHandles) {
      const key = handle.toLowerCase();
      const existing = handles.get(key);
      if (existing && existing !== agent.id) {
        throw new Error(`mention handle "${handle}" is already used by agent "${existing}"`);
      }
      handles.set(key, agent.id);
    }
  }
}

function safePath(projectRoot: string, ...segments: string[]): string {
  const root = resolve(projectRoot);
  const normalized = resolve(root, ...segments);
  const rel = relative(root, normalized);
  if (rel.startsWith(`..${sep}`) || rel === "..") {
    throw new Error(`Path escapes project root: ${normalized}`);
  }
  return normalized;
}

function writeFileAtomic(filePath: string, content: string): void {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, content, "utf8");
  try {
    renameSync(tempPath, filePath);
  } catch (err) {
    try {
      unlinkSync(tempPath);
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
}
