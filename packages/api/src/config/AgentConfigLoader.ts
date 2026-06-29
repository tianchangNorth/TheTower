import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { z } from "zod";
import type { Agent, AgentPersona, AgentProvider } from "../types.js";

export interface AgentCatalog {
  version: 1;
  agents: Agent[];
}

const CONFIG_DIR = ".the-tower";
const CATALOG_FILENAME = "agent-catalog.json";

const agentProviderSchema = z.enum(["codex", "claude", "gemini", "openai-api", "custom", "mock"]);

export const personaSchema = z.object({
  roleDescription: z.string().min(1),
  personality: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  restrictions: z.array(z.string()).default([]),
  background: z.string().optional(),
  voice: z
    .object({
      instruct: z.string().optional(),
      tone: z.string().optional(),
    })
    .optional(),
  quirks: z.array(z.string()).optional(),
  signature: z.string().optional(),
});

/**
 * 接受两种输入并统一输出 persona：
 *  - 新格式：{ persona }
 *  - 旧格式：{ rolePrompt }（legacy，迁移为 persona）
 * 持久化时只写 persona，旧字段在首次加载后被回写升级。
 */
const agentSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    mentionHandles: z.array(z.string().min(2).regex(/^@/, "mention handle must start with @")).min(1),
    provider: agentProviderSchema,
    model: z.string().min(1),
    persona: personaSchema.optional(),
    rolePrompt: z.string().optional(),
    enabled: z.boolean(),
    createdAt: z.number().int().positive().optional(),
  })
  .transform((value) => {
    const persona = value.persona ?? migrateLegacyRolePrompt(value.rolePrompt);
    return {
      id: value.id,
      displayName: value.displayName,
      mentionHandles: value.mentionHandles,
      provider: value.provider,
      model: value.model,
      persona,
      enabled: value.enabled,
      createdAt: value.createdAt,
    };
  });

const catalogSchema = z.object({
  version: z.literal(1),
  agents: z.array(agentSchema).min(1),
});

type RawAgent = z.infer<typeof agentSchema>;

/**
 * 把旧的单段 rolePrompt 启发式拆成结构化 persona。
 * 形如 "你是 TheTower 平台中的 X。你负责…。你的回复要…。"
 * → roleDescription = "你负责…"句，personality = "你的回复要…"句去壳。
 */
export function migrateLegacyRolePrompt(rolePrompt?: string): AgentPersona {
  if (!rolePrompt || !rolePrompt.trim()) {
    throw new Error("agent must have persona or legacy rolePrompt");
  }
  let text = rolePrompt.trim();
  // 剥离前导身份句"你是…平台中的…。"
  text = text.replace(/^你是[^。]*?平台中的[^。]+。/, "").trim();
  const sentences = text
    .split(/(?<=。)/)
    .map((s) => s.trim())
    .filter(Boolean);
  const personalityIdx = sentences.findIndex((s) => s.startsWith("你的回复要"));
  let personality = "";
  if (personalityIdx >= 0) {
    personality = sentences
      .splice(personalityIdx, 1)[0]!
      .replace(/^你的回复要/, "")
      .replace(/。$/, "")
      .trim();
  }
  const roleDescription = sentences
    .join("")
    .replace(/^你负责/, "")
    .replace(/。$/, "")
    .trim();
  return {
    roleDescription: roleDescription || rolePrompt.trim(),
    // personaSchema 要求 personality 非空；旧 prompt 无"你的回复要"句时回退到角色描述，operator 后续可精修。
    personality: personality || roleDescription || rolePrompt.trim(),
    strengths: [],
    restrictions: [],
  };
}

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
  if (!existsSync(catalogPath)) {
    bootstrapAgentCatalog(projectRoot);
    return readAndValidateCatalog(catalogPath);
  }
  const raw = readFileSync(catalogPath, "utf8");
  const catalog = parseCatalogContent(raw, catalogPath);
  // 旧 catalog（含 rolePrompt）迁移为 persona 后一次性回写磁盘。
  if (/"rolePrompt"\s*:/.test(raw)) {
    return saveAgentCatalog(catalog, projectRoot);
  }
  return catalog;
}

export function saveAgentCatalog(catalog: AgentCatalog, projectRoot = resolveProjectRoot()): AgentCatalog {
  validateUniqueAgentConfig(catalog.agents);
  const catalogPath = resolveAgentCatalogPath(projectRoot);
  mkdirSync(dirname(catalogPath), { recursive: true });
  const normalized = normalizeCatalog(catalog);
  writeFileAtomic(catalogPath, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
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
  return parseCatalogContent(raw, filePath);
}

function parseCatalogContent(raw: string, filePath: string): AgentCatalog {
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
    id: input.id,
    displayName: input.displayName,
    mentionHandles: input.mentionHandles,
    provider: input.provider,
    model: normalizeAgentModel(input.provider, input.model),
    persona: input.persona,
    enabled: input.enabled,
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
