import type { AgentRunInput } from "../../types.js";

export function resolveInvocationWorkingDirectory(input: AgentRunInput, fallbackCwd: string): string {
  const value = input.workingDirectory?.trim();
  return value ? value : fallbackCwd;
}
