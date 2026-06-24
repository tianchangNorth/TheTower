import type Database from "better-sqlite3";
import type { Agent, AgentProvider } from "../types.js";

interface AgentRow {
  id: string;
  display_name: string;
  mention_handles_json: string;
  provider: AgentProvider;
  model: string;
  role_prompt: string;
  enabled: number;
  created_at: number;
}

function toAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    displayName: row.display_name,
    mentionHandles: JSON.parse(row.mention_handles_json) as string[],
    provider: row.provider,
    model: row.model,
    rolePrompt: row.role_prompt,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

export class AgentStore {
  constructor(private readonly db: Database.Database) {}

  upsert(agent: Agent): void {
    this.db
      .prepare(
        `
        INSERT INTO agents (
          id, display_name, mention_handles_json, provider, model, role_prompt, enabled, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          display_name = excluded.display_name,
          mention_handles_json = excluded.mention_handles_json,
          provider = excluded.provider,
          model = excluded.model,
          role_prompt = excluded.role_prompt,
          enabled = excluded.enabled
      `,
      )
      .run(
        agent.id,
        agent.displayName,
        JSON.stringify(agent.mentionHandles),
        agent.provider,
        agent.model,
        agent.rolePrompt,
        agent.enabled ? 1 : 0,
        agent.createdAt,
      );
  }

  get(id: string): Agent | null {
    const row = this.db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as AgentRow | undefined;
    return row ? toAgent(row) : null;
  }

  list(): Agent[] {
    const rows = this.db.prepare("SELECT * FROM agents ORDER BY created_at ASC").all() as AgentRow[];
    return rows.map(toAgent);
  }
}
