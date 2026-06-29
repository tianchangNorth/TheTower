import type Database from "better-sqlite3";
import type { Workspace } from "../types.js";

interface WorkspaceRow {
  id: string;
  name: string;
  project_path: string;
  trusted_at: number;
  last_opened_at: number;
  created_at: number;
}

function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    projectPath: row.project_path,
    trustedAt: row.trusted_at,
    lastOpenedAt: row.last_opened_at,
    createdAt: row.created_at,
  };
}

export class WorkspaceStore {
  constructor(private readonly db: Database.Database) {}

  upsert(workspace: Workspace): Workspace {
    this.db
      .prepare(
        `
        INSERT INTO workspaces (id, name, project_path, trusted_at, last_opened_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_path) DO UPDATE SET
          name = excluded.name,
          last_opened_at = excluded.last_opened_at
      `,
      )
      .run(
        workspace.id,
        workspace.name,
        workspace.projectPath,
        workspace.trustedAt,
        workspace.lastOpenedAt,
        workspace.createdAt,
      );
    const stored = this.getByProjectPath(workspace.projectPath);
    if (!stored) throw new Error(`workspace was not stored: ${workspace.projectPath}`);
    return stored;
  }

  get(id: string): Workspace | null {
    const row = this.db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id) as WorkspaceRow | undefined;
    return row ? toWorkspace(row) : null;
  }

  getByProjectPath(projectPath: string): Workspace | null {
    const row = this.db
      .prepare("SELECT * FROM workspaces WHERE project_path = ?")
      .get(projectPath) as WorkspaceRow | undefined;
    return row ? toWorkspace(row) : null;
  }

  list(limit = 50): Workspace[] {
    const rows = this.db
      .prepare("SELECT * FROM workspaces ORDER BY last_opened_at DESC LIMIT ?")
      .all(limit) as WorkspaceRow[];
    return rows.map(toWorkspace);
  }
}
