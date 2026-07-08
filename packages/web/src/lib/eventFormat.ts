import type { ServerEvent } from "@the-tower/shared";
import { shortId, workspaceLabel } from "./format";

/** 把 ServerEvent 格式化为一行可读标签，供 EventFeed 默认展示。 */
export function formatEventLabel(event: ServerEvent): string {
  if (event.type === "invocation.updated") return `invocation ${event.status}`;
  if (event.type === "agent.status") return `${event.agentId} status ${event.status.status}`;
  if (event.type === "agent.token_usage")
    return `${event.agentId} token ${event.status.tokenUsage?.totalTokens ?? "--"}`;
  if (event.type === "agent.liveness") return `${event.agentId} liveness ${event.status.status}`;
  if (event.type === "workspace.resolved")
    return `workspace ${workspaceLabel(event.workingDirectory ?? event.projectPath)}`;
  if (event.type === "workspace.file_tool") {
    const status = event.denied ? `denied${event.reason ? `: ${event.reason}` : ""}` : "ok";
    const bytes = event.bytes === undefined ? "" : ` ${event.bytes}b`;
    return `${event.agentId} ${event.tool}${bytes} ${status}`;
  }
  if (event.type === "worklist.updated") return `worklist ${event.agents.join(" -> ")}`;
  if (event.type === "agent.event") {
    if (event.eventType === "stream_text") return `${event.agentId} output ${event.content ?? ""}`.trim();
    if (event.eventType === "tool_call") return `${event.agentId} tool ${event.name ?? ""}`.trim();
    if (event.eventType === "error") return `${event.agentId} error ${event.error ?? ""}`.trim();
    return `${event.agentId} ${event.eventType}`;
  }
  if (event.type === "callback.write") {
    const routed = event.routed.length > 0 ? ` -> ${event.routed.join(", ")}` : "";
    return `${event.agentId} callback ${event.visibility}${routed}`;
  }
  if (event.type === "message.created") return `message ${shortId(event.messageId)} created`;
  if (event.type === "message.updated") return `message ${shortId(event.messageId)} updated`;
  return "event";
}
