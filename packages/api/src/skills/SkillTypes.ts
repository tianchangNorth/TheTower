import type { Agent, Message, ResolvedSkill, WorklistEntry } from "../types.js";

export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  category?: string;
  enabled: boolean;
  priority: number;
  triggers: {
    always?: boolean;
    handoff?: boolean;
    receiveHandoff?: boolean;
    finalAgent?: boolean;
    keywords?: string[];
  };
  notFor?: string[];
  output?: string;
  next?: string[];
}

export interface SkillDefinition {
  manifest: SkillManifest;
  prompt: string;
}

export interface SkillResolverInput {
  agent: Agent;
  messages: Message[];
  worklist: Pick<WorklistEntry, "list" | "currentIndex" | "a2aFrom">;
}

export type { ResolvedSkill };
