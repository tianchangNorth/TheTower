import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = join(repoRoot, "docs");
const manifestPath = join(docsRoot, "metadata.json");
const generatedIndexPath = join(docsRoot, "README.md");
const allowedStatuses = new Set(["current", "accepted", "completed-record", "reference", "superseded"]);
const allowedKinds = new Set([
  "acceptance",
  "adr",
  "architecture",
  "capability-matrix",
  "design",
  "frontend",
  "implementation-record",
  "phase",
  "research",
  "roadmap",
  "runbook",
  "theory",
]);

const command = process.argv[2] ?? "check";

try {
  if (command === "lint") {
    const { manifest, documents } = loadAndValidate();
    validateMarkdownLinks([join(repoRoot, "README.md"), ...listMarkdownFiles(docsRoot)]);
    console.log(`docs:lint passed (${documents.length} managed documents, schema v${manifest.version})`);
  } else if (command === "generate") {
    const { manifest, documents } = loadAndValidate();
    const output = renderIndex(manifest, documents);
    writeFileSync(generatedIndexPath, output);
    console.log(`generated ${relative(repoRoot, generatedIndexPath)} from ${relative(repoRoot, manifestPath)}`);
  } else if (command === "check") {
    const { manifest, documents } = loadAndValidate();
    validateMarkdownLinks([join(repoRoot, "README.md"), ...listMarkdownFiles(docsRoot)]);
    const expected = renderIndex(manifest, documents);
    const actual = readFileSync(generatedIndexPath, "utf8");
    if (actual !== expected) {
      throw new Error("docs/README.md is stale; run `pnpm docs:generate` and commit the result");
    }
    console.log(`docs:check passed (${documents.length} managed documents, generated index is current)`);
  } else {
    throw new Error(`unknown command "${command}"; use lint, generate, or check`);
  }
} catch (error) {
  console.error(`docs:${command} failed: ${(error instanceof Error ? error.message : String(error))}`);
  process.exitCode = 1;
}

function loadAndValidate() {
  if (!existsSync(manifestPath)) throw new Error("docs/metadata.json does not exist");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const errors = [];

  if (manifest.version !== 1) errors.push("metadata.version must be 1");
  if (manifest.generatedIndex !== "docs/README.md") {
    errors.push("metadata.generatedIndex must be docs/README.md");
  }
  if (!Array.isArray(manifest.documents)) errors.push("metadata.documents must be an array");

  const documents = Array.isArray(manifest.documents) ? manifest.documents : [];
  const byPath = new Map();
  const truthScopes = new Map();

  for (const [index, document] of documents.entries()) {
    const label = `documents[${index}]`;
    if (!document || typeof document !== "object") {
      errors.push(`${label} must be an object`);
      continue;
    }
    for (const key of ["path", "title", "status", "kind"]) {
      if (typeof document[key] !== "string" || !document[key].trim()) errors.push(`${label}.${key} is required`);
    }
    if (typeof document.path !== "string") continue;
    if (!document.path.startsWith("docs/") || document.path.includes("..") || document.path.includes("\\")) {
      errors.push(`${label}.path must be a normalized path under docs/: ${document.path}`);
    }
    if (document.path === manifest.generatedIndex) errors.push(`${label}.path must not list the generated index`);
    if (byPath.has(document.path)) errors.push(`duplicate metadata path: ${document.path}`);
    byPath.set(document.path, document);

    if (!allowedStatuses.has(document.status)) errors.push(`${document.path}: invalid status "${document.status}"`);
    if (!allowedKinds.has(document.kind)) errors.push(`${document.path}: invalid kind "${document.kind}"`);

    const absolutePath = join(repoRoot, document.path);
    if (!existsSync(absolutePath)) {
      errors.push(`${document.path}: file does not exist`);
    } else {
      const heading = firstHeading(readFileSync(absolutePath, "utf8"));
      if (heading !== document.title) {
        errors.push(`${document.path}: title metadata "${document.title}" does not match H1 "${heading ?? "<missing>"}"`);
      }
    }

    if (document.status === "current") {
      if (!isIsoDate(document.lastVerified)) errors.push(`${document.path}: current document requires lastVerified YYYY-MM-DD`);
      if (!Array.isArray(document.truthScopes) || document.truthScopes.length === 0) {
        errors.push(`${document.path}: current document requires at least one truthScopes entry`);
      } else {
        for (const scope of document.truthScopes) {
          if (typeof scope !== "string" || !scope.trim()) {
            errors.push(`${document.path}: truthScopes entries must be non-empty strings`);
            continue;
          }
          const owner = truthScopes.get(scope);
          if (owner) errors.push(`truth scope "${scope}" has multiple current owners: ${owner}, ${document.path}`);
          else truthScopes.set(scope, document.path);
        }
      }
    } else if (document.truthScopes !== undefined) {
      errors.push(`${document.path}: only current documents may declare truthScopes`);
    }

    if (document.status === "superseded") {
      if (!Array.isArray(document.replacedBy) || document.replacedBy.length === 0) {
        errors.push(`${document.path}: superseded document requires replacedBy`);
      }
      if (existsSync(absolutePath) && !readFileSync(absolutePath, "utf8").includes("文档状态：Superseded")) {
        errors.push(`${document.path}: superseded document must show a visible Superseded banner`);
      }
    } else if (document.replacedBy !== undefined) {
      errors.push(`${document.path}: replacedBy is only valid for superseded documents`);
    }

    if (document.status === "accepted" && document.kind !== "adr") {
      errors.push(`${document.path}: accepted status is reserved for ADR documents`);
    }
  }

  for (const document of documents) {
    if (!Array.isArray(document.replacedBy)) continue;
    for (const replacementPath of document.replacedBy) {
      const replacement = byPath.get(replacementPath);
      if (!replacement) errors.push(`${document.path}: replacement is not managed: ${replacementPath}`);
      else if (replacement.status === "superseded") {
        errors.push(`${document.path}: replacement must not itself be superseded: ${replacementPath}`);
      }
    }
  }

  const diskDocuments = listMarkdownFiles(docsRoot)
    .map((path) => toRepoPath(path))
    .filter((path) => path !== manifest.generatedIndex)
    .sort();
  const managedDocuments = [...byPath.keys()].sort();
  for (const path of diskDocuments) if (!byPath.has(path)) errors.push(`Markdown document is missing metadata: ${path}`);
  for (const path of managedDocuments) if (!diskDocuments.includes(path)) errors.push(`metadata lists a non-Markdown document: ${path}`);

  if (errors.length) throw new Error(`metadata validation found ${errors.length} issue(s):\n- ${errors.join("\n- ")}`);
  return { manifest, documents };
}

function validateMarkdownLinks(files) {
  const errors = [];
  const markdownLink = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(markdownLink)) {
      let target = match[1].trim();
      if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
      target = target.replace(/^<|>$/g, "").split("#")[0];
      if (!target) continue;
      try {
        target = decodeURIComponent(target);
      } catch {
        errors.push(`${toRepoPath(file)}: invalid URL encoding in ${match[1]}`);
        continue;
      }
      const resolved = resolve(dirname(file), target);
      if (!existsSync(resolved)) errors.push(`${toRepoPath(file)}: broken relative link ${match[1]}`);
    }
  }
  if (errors.length) throw new Error(`Markdown link validation found ${errors.length} issue(s):\n- ${errors.join("\n- ")}`);
}

function renderIndex(manifest, documents) {
  const sections = [
    ["current", "当前真相源", "这些文档描述当前能力、实现、路线与操作方法。"],
    ["accepted", "已采纳 ADR", "架构决策记录解释关键约束及其原因。"],
    ["completed-record", "实施与验收记录", "带日期的完成证据，不承担未来路线维护。"],
    ["reference", "调研与理论参考", "用于理解背景，不代表当前产品承诺。"],
    ["superseded", "历史设计与 Phase", "已被替代，仅保留设计背景和实施历史。"],
  ];
  const lines = [
    "<!-- GENERATED FILE: run `pnpm docs:generate`; source: docs/metadata.json -->",
    "# TheTower 文档索引",
    "",
    "本文由 `docs/metadata.json` 自动生成，请勿手工维护分类或状态。修改 metadata 后运行 `pnpm docs:generate`，提交前运行 `pnpm docs:check`。",
    "",
    "## 真相源规则",
    "",
    "- 当前是否支持某能力：能力矩阵；",
    "- 当前系统如何工作：Current 架构与页面说明；",
    "- 后续做什么：技术/产品 Roadmap；",
    "- 为什么这样设计：Accepted ADR；",
    "- 如何验收：Runbook 与 Completed record；",
    "- `Superseded` 与 `Reference` 文档不得作为当前发布承诺。",
    "",
  ];

  for (const [status, heading, description] of sections) {
    lines.push(`## ${heading}`, "", description, "");
    const matching = documents
      .filter((document) => document.status === status)
      .sort((a, b) => a.path.localeCompare(b.path, "en", { numeric: true }));
    for (const document of matching) {
      const link = `./${relative("docs", document.path).split(sep).join("/")}`;
      const suffix = status === "current" ? ` — ${kindLabel(document.kind)}，核验 ${document.lastVerified}` : ` — ${kindLabel(document.kind)}`;
      lines.push(`- [${document.title}](${link})${suffix}`);
    }
    lines.push("");
  }

  lines.push(`_Metadata schema v${manifest.version}；共管理 ${documents.length} 份文档。_`, "");
  return `${lines.join("\n")}`;
}

function kindLabel(kind) {
  return {
    acceptance: "验收记录",
    adr: "架构决策",
    architecture: "架构",
    "capability-matrix": "能力口径",
    design: "设计方案",
    frontend: "前端",
    "implementation-record": "实施记录",
    phase: "Phase 记录",
    research: "调研",
    roadmap: "Roadmap",
    runbook: "运行手册",
    theory: "理论说明",
  }[kind] ?? kind;
}

function listMarkdownFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...listMarkdownFiles(path));
    else if (entry.isFile() && path.endsWith(".md")) files.push(path);
  }
  return files.sort();
}

function firstHeading(content) {
  return content.match(/^#\s+(.+)$/m)?.[1].trim();
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function toRepoPath(path) {
  return relative(repoRoot, path).split(sep).join("/");
}
