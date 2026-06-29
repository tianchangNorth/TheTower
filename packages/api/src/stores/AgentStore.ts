import type Database from "better-sqlite3";
import type { Agent, AgentPersona, AgentProvider } from "../types.js";
import { migrateLegacyRolePrompt } from "../config/AgentConfigLoader.js";

interface AgentRow {
  id: string;
  display_name: string;
  mention_handles_json: string;
  provider: AgentProvider;
  model: string;
  role_prompt?: string;
  persona_json?: string | null;
  enabled: number;
  created_at: number;
}

function toAgent(row: AgentRow): Agent {
  const persona: AgentPersona | null = row.persona_json
    ? (JSON.parse(row.persona_json) as AgentPersona)
    : null;
  return {
    id: row.id,
    displayName: row.display_name,
    mentionHandles: JSON.parse(row.mention_handles_json) as string[],
    provider: row.provider,
    model: row.model,
    persona: persona ?? migrateLegacyRolePrompt(row.role_prompt),
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

export class AgentStore {
  constructor(private readonly db: Database.Database) {}

  replaceAll(agents: Agent[]): void {
    const replace = this.db.transaction((items: Agent[]) => {
      if (items.length === 0) {
        this.db.prepare("DELETE FROM agents").run();
        return;
      }

      const placeholders = items.map(() => "?").join(", ");
      this.db.prepare(`DELETE FROM agents WHERE id NOT IN (${placeholders})`).run(...items.map((agent) => agent.id));
      for (const agent of items) this.upsert(agent);
    });

    replace(agents);
  }

  upsert(agent: Agent): void {
    this.db
      .prepare(
        `
        INSERT INTO agents (
          id, display_name, mention_handles_json, provider, model, role_prompt, persona_json, enabled, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          display_name = excluded.display_name,
          mention_handles_json = excluded.mention_handles_json,
          provider = excluded.provider,
          model = excluded.model,
          role_prompt = excluded.role_prompt,
          persona_json = excluded.persona_json,
          enabled = excluded.enabled
      `,
      )
      .run(
        agent.id,
        agent.displayName,
        JSON.stringify(agent.mentionHandles),
        agent.provider,
        agent.model,
        "",
        JSON.stringify(agent.persona),
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
