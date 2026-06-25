import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SkillDefinition, SkillManifest } from "./SkillTypes.js";

export class SkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>();

  constructor(private readonly rootDir: string) {}

  load(): void {
    this.skills.clear();
    if (!existsSync(this.rootDir)) return;

    const manifestById = loadGlobalManifest(this.rootDir);
    for (const entry of readdirSync(this.rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillDir = join(this.rootDir, entry.name);
      const manifestPath = join(skillDir, "skill.yaml");
      const promptPath = join(skillDir, "SKILL.md");
      if (!existsSync(promptPath)) continue;

      const skillSource = readFileSync(promptPath, "utf8");
      const frontmatter = parseFrontmatter(skillSource);
      const prompt = frontmatter.body.trim();
      const manifest =
        manifestById.get(entry.name) ??
        (existsSync(manifestPath) ? parseSkillManifest(readFileSync(manifestPath, "utf8")) : undefined) ??
        parseSkillManifest(frontmatter.yaml);
      if (!manifest.enabled) continue;
      this.skills.set(manifest.id, { manifest, prompt });
    }
  }

  list(): SkillDefinition[] {
    return [...this.skills.values()].sort((a, b) => b.manifest.priority - a.manifest.priority);
  }

  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }
}

function loadGlobalManifest(rootDir: string): Map<string, SkillManifest> {
  const manifestPath = join(rootDir, "manifest.yaml");
  if (!existsSync(manifestPath)) return new Map();
  return parseGlobalManifest(readFileSync(manifestPath, "utf8"));
}

function parseGlobalManifest(source: string): Map<string, SkillManifest> {
  const result = new Map<string, SkillManifest>();
  const lines = source.split(/\r?\n/);
  let currentId = "";
  let currentBlock: string[] = [];

  const flush = () => {
    if (!currentId) return;
    const manifest = parseSkillManifest(["id: " + currentId, ...currentBlock].join("\n"));
    result.set(currentId, manifest);
  };

  for (const rawLine of lines) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#") || rawLine.trim() === "skills:") continue;
    const skillMatch = rawLine.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (skillMatch?.[1]) {
      flush();
      currentId = skillMatch[1];
      currentBlock = [];
      continue;
    }
    if (currentId && rawLine.startsWith("    ")) {
      currentBlock.push(rawLine.slice(4));
    }
  }
  flush();
  return result;
}

function parseSkillManifest(source: string): SkillManifest {
  const lines = source.split(/\r?\n/);
  const manifest: SkillManifest = {
    id: "",
    name: "",
    description: "",
    enabled: true,
    priority: 0,
    triggers: {},
  };
  let section: "root" | "triggers" | "not_for" | "next" = "root";
  let foldedKey: string | undefined;
  let foldedValue: string[] = [];

  const flushFolded = () => {
    if (!foldedKey) return;
    applyRootValue(manifest, foldedKey, foldedValue.join(" ").trim());
    foldedKey = undefined;
    foldedValue = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (foldedKey && rawLine.startsWith("  ")) {
      foldedValue.push(line);
      continue;
    }
    flushFolded();
    if (line === "triggers:") {
      section = "triggers";
      continue;
    }
    if (line === "not_for:") {
      section = "not_for";
      continue;
    }
    if (line === "next:") {
      section = "next";
      continue;
    }
    if (line.startsWith("- ")) {
      if (section === "triggers") {
        manifest.triggers.keywords = [...(manifest.triggers.keywords ?? []), parseString(line.slice(2))];
      }
      if (section === "not_for") {
        manifest.notFor = [...(manifest.notFor ?? []), parseString(line.slice(2))];
      }
      if (section === "next") {
        manifest.next = [...(manifest.next ?? []), parseString(line.slice(2))];
      }
      continue;
    }
    if (!line.includes(":")) continue;

    const [rawKey, ...rawValue] = line.split(":");
    const key = rawKey?.trim();
    const value = rawValue.join(":").trim();
    if (!key) continue;

    if (section === "triggers" && rawLine.startsWith("  ")) {
      if (key === "keywords") {
        manifest.triggers.keywords = parseInlineArray(value);
      } else {
        manifest.triggers[key as keyof Omit<SkillManifest["triggers"], "keywords">] = parseBoolean(value);
      }
      continue;
    }

    section = "root";
    if (value === ">") {
      foldedKey = key;
      foldedValue = [];
      continue;
    }
    applyRootValue(manifest, key, value);
  }
  flushFolded();

  if (!manifest.id) throw new Error("skill manifest missing id");
  if (!manifest.name) manifest.name = manifest.id;
  return manifest;
}

function applyRootValue(manifest: SkillManifest, key: string, value: string): void {
  if (key === "id") manifest.id = parseString(value);
  if (key === "name") manifest.name = parseString(value);
  if (key === "description") manifest.description = parseString(value);
  if (key === "category") manifest.category = parseString(value);
  if (key === "enabled") manifest.enabled = parseBoolean(value);
  if (key === "priority") manifest.priority = Number.parseInt(value, 10) || 0;
  if (key === "output") manifest.output = parseString(value);
  if (key === "next") manifest.next = parseInlineArray(value);
}

function parseFrontmatter(source: string): { yaml: string; body: string } {
  if (!source.startsWith("---")) return { yaml: "", body: source };
  const end = source.indexOf("\n---", 3);
  if (end === -1) return { yaml: "", body: source };
  return {
    yaml: source.slice(3, end).trim(),
    body: source.slice(end + 4).trimStart(),
  };
}

function parseString(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

function parseBoolean(value: string): boolean {
  return value === "true" || value === "yes" || value === "1";
}

function parseInlineArray(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return trimmed ? [parseString(trimmed)] : [];
  return trimmed
    .slice(1, -1)
    .split(",")
    .map((item) => parseString(item.trim()))
    .filter(Boolean);
}
