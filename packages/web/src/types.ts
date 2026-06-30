import type { AgentRuntimeStatus } from "@the-tower/shared";

export type AppPage = "command" | "agents" | "telemetry" | "workspaces" | "tasks" | "settings";

export interface EventLogItem {
  id: number;
  receivedAt: number;
  event: ServerEvent;
}

export type ServerEvent =
  | { type: "message.created"; threadId: string; messageId: string }
  | { type: "message.updated"; threadId: string; messageId: string }
  | { type: "invocation.updated"; threadId: string; invocationId: string; status: string }
  | {
      type: "agent.status" | "agent.token_usage" | "agent.liveness";
      threadId: string;
      invocationId: string;
      agentId: string;
      status: AgentRuntimeStatus;
      createdAt: number;
    }
  | {
      type: "workspace.resolved";
      threadId: string;
      invocationId: string;
      projectPath?: string;
      workingDirectory?: string;
      workspaceFingerprint?: string;
    }
  | {
      type: "workspace.file_tool";
      threadId: string;
      invocationId: string;
      agentId: string;
      tool: "read_file" | "read_file_slice" | "list_files" | "write_file";
      path: string;
      bytes?: number;
      denied: boolean;
      reason?: string;
      createdAt: number;
    }
  | { type: "worklist.updated"; threadId: string; invocationId: string; agents: string[] }
  | {
      type: "agent.event";
      threadId: string;
      invocationId: string;
      agentId: string;
      eventType: "text" | "tool_call" | "error" | "done";
      name?: string;
      error?: string;
    }
  | {
      type: "callback.write";
      threadId: string;
      invocationId: string;
      agentId: string;
      messageId: string;
      visibility: "public" | "private";
      routed: string[];
    };

export type MessageAuditFilter = "all" | "private" | "callback" | "privateCallback" | "revealed" | "handoff";

export const messageAuditFilters: Array<{ id: MessageAuditFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "private", label: "Private" },
  { id: "callback", label: "Callback" },
  { id: "privateCallback", label: "Private callback" },
  { id: "revealed", label: "Revealed" },
  { id: "handoff", label: "Handoff" },
];
