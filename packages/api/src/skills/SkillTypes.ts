import type { Agent, Message, WorklistEntry } from "@the-tower/shared";

// SkillManifest / SkillDefinition / ResolvedSkill are defined in the shared package so the
// SDK and web can type the skill catalog endpoints. Re-export here for internal callers.
export type { SkillManifest, SkillDefinition, ResolvedSkill } from "@the-tower/shared";

export interface SkillResolverInput {
  agent: Agent;
  messages: Message[];
  worklist: Pick<WorklistEntry, "list" | "currentIndex" | "a2aFrom">;
}
