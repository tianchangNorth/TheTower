import type { ResolvedSkill, SkillResolverInput } from "./SkillTypes.js";
import { SkillRegistry } from "./SkillRegistry.js";

export class SkillResolver {
  constructor(private readonly registry: SkillRegistry) {}

  resolve(input: SkillResolverInput): ResolvedSkill[] {
    const currentIndex = input.worklist.currentIndex;
    const worklist = input.worklist.list;
    const latestContent = input.messages.at(-1)?.content ?? "";
    const isBeforeLast = worklist.length > 1 && currentIndex < worklist.length - 1;
    const isReceivingHandoff = !!input.worklist.a2aFrom[input.agent.id];
    const isFinalAgent = currentIndex >= worklist.length - 1;

    return this.registry
      .list()
      .filter((skill) => {
        const triggers = skill.manifest.triggers;
        return (
          triggers.always ||
          (triggers.handoff && isBeforeLast) ||
          (triggers.receiveHandoff && isReceivingHandoff) ||
          (triggers.finalAgent && isFinalAgent) ||
          (triggers.keywords?.some((keyword) => latestContent.includes(keyword)) ?? false)
        );
      })
      .map((skill) => ({
        id: skill.manifest.id,
        name: skill.manifest.name,
        priority: skill.manifest.priority,
        prompt: skill.prompt,
      }))
      .sort((a, b) => b.priority - a.priority);
  }
}

export function createDefaultSkillResolver(projectRoot: string): SkillResolver {
  const registry = new SkillRegistry(`${projectRoot}/skills`);
  registry.load();
  return new SkillResolver(registry);
}
