import type { Agent } from "../types.js";

export class AgentRegistry {
  private readonly agents = new Map<string, Agent>();
  private readonly handleToAgentId = new Map<string, string>();

  register(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent "${agent.id}" is already registered`);
    }
    for (const handle of agent.mentionHandles) {
      const key = normalizeHandle(handle);
      const existing = this.handleToAgentId.get(key);
      if (existing && existing !== agent.id) {
        throw new Error(`Mention handle "${handle}" is already used by agent "${existing}"`);
      }
    }
    this.agents.set(agent.id, agent);
    for (const handle of agent.mentionHandles) {
      this.handleToAgentId.set(normalizeHandle(handle), agent.id);
    }
  }

  replaceAll(agents: Agent[]): void {
    this.agents.clear();
    this.handleToAgentId.clear();
    for (const agent of agents) {
      this.register(agent);
    }
  }

  get(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  list(): Agent[] {
    return [...this.agents.values()];
  }

  resolveHandle(handle: string): Agent | undefined {
    const id = this.handleToAgentId.get(normalizeHandle(handle));
    return id ? this.agents.get(id) : undefined;
  }
}

export function normalizeHandle(handle: string): string {
  const trimmed = handle.trim();
  return (trimmed.startsWith("@") ? trimmed : `@${trimmed}`).toLowerCase();
}
