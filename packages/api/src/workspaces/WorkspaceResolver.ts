import type { AgentProvider, Thread } from "../types.js";
import { buildWorkspaceFingerprint, validateProjectPathDetailed } from "./projectPath.js";

export interface ResolvedThreadWorkspace {
  projectPath?: string;
  workingDirectory?: string;
  workspaceFingerprint?: string;
}

export async function resolveThreadWorkspace(thread: Thread | null): Promise<ResolvedThreadWorkspace> {
  const projectPath = thread?.projectPath?.trim();
  if (!projectPath) return {};
  const validated = await validateProjectPathDetailed(projectPath);
  if (!validated.ok) {
    throw new Error(
      `Invalid thread projectPath: ${projectPath}. ${validated.message ?? `Validation failed: ${validated.reason}`}`,
    );
  }
  return {
    projectPath,
    workingDirectory: validated.path,
    workspaceFingerprint: buildWorkspaceFingerprint(validated.path),
  };
}

export interface ProviderWorkspacePolicy {
  requiresThreadWorkspace: boolean;
}

export function getProviderWorkspacePolicy(provider: AgentProvider): ProviderWorkspacePolicy {
  switch (provider) {
    case "mock":
    case "openai-api":
      return { requiresThreadWorkspace: false };
    case "codex":
    case "claude":
    case "gemini":
    case "custom":
      return { requiresThreadWorkspace: true };
  }
}
