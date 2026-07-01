"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Boxes, FolderTree, RefreshCw, Save } from "lucide-react";
import type {
  Agent,
  AgentRuntimeStatus,
  Message,
  Thread,
  ThreadMode,
  Workspace,
} from "@the-tower/shared";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { SegmentedControl } from "@/components/hud/SegmentedControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RuntimeStatusStrip } from "./RuntimeStatusStrip";
import { MessageBubble } from "./MessageBubble";
import { CommandComposer } from "./CommandComposer";
import {
  buildMessageAuditCounts,
  matchesMessageAuditFilter,
  messageAuditFilters,
} from "@/lib/messageAudit";
import { projectMessagesToBubbles } from "@/messageProjection";
import type { MessageAuditFilter } from "@/types";

export interface MissionFeedProps {
  threadId?: string;
  thread: Thread | undefined;
  agents: Agent[];
  statuses: Record<string, AgentRuntimeStatus>;
  messages: Message[];
  filter: MessageAuditFilter;
  onFilterChange: (value: MessageAuditFilter) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  sendError?: string;
  projectPath: string;
  onProjectPathChange: (value: string) => void;
  onProjectPathSave: (path: string) => void;
  onModeChange: (mode: ThreadMode) => void;
  onReveal: (messageId: string) => void;
  onReload: () => void;
  workspaces: Workspace[];
}

export function MissionFeed({
  threadId,
  thread,
  agents,
  statuses,
  messages,
  filter,
  onFilterChange,
  draft,
  onDraftChange,
  onSend,
  busy,
  sendError,
  projectPath,
  onProjectPathChange,
  onProjectPathSave,
  onModeChange,
  onReveal,
  onReload,
  workspaces,
}: MissionFeedProps) {
  const [pathDraft, setPathDraft] = useState(thread?.projectPath ?? "");
  useEffect(() => {
    setPathDraft(thread?.projectPath ?? "");
  }, [thread?.id, thread?.projectPath]);

  const bubbles = useMemo(() => projectMessagesToBubbles(messages), [messages]);
  const counts = useMemo(() => buildMessageAuditCounts(messages), [messages]);
  const visible = useMemo(
    () => bubbles.filter((m) => matchesMessageAuditFilter(m, filter)),
    [bubbles, filter],
  );
  const mode = thread?.mode ?? "debug";

  return (
    <HudPanel accent className="min-w-0 flex-1">
      <PanelHeader
        title={thread?.title ?? "New thread"}
        action={
          <div className="flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm">
              <Link href="/agents">
                <Boxes size={13} />
                Agents
              </Link>
            </Button>
            {threadId ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/telemetry/${threadId}`}>
                  <Activity size={13} />
                  Telemetry
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link href="/workspaces">
                <FolderTree size={13} />
                Workspace
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={onReload} title="Reload">
              <RefreshCw size={14} />
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-tower-border-subtle px-2.5 py-1.5">
        <SegmentedControl<ThreadMode>
          value={mode}
          onChange={onModeChange}
          options={[
            { id: "debug", label: "debug" },
            { id: "play", label: "play" },
          ]}
        />
        <label className="flex items-center gap-1.5 text-[11px] text-tower-text-muted">
          Working directory
          <Input
            value={pathDraft}
            onChange={(event) => setPathDraft(event.target.value)}
            placeholder="/path/to/project"
            className="h-7.5 w-50"
          />
        </label>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onProjectPathSave(pathDraft)}
          disabled={!threadId}
        >
          <Save size={13} />
          Save
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b border-tower-border-subtle px-2.5 py-1.5">
        <span className="text-[11px] font-bold uppercase text-tower-text-muted">Audit</span>
        <SegmentedControl<MessageAuditFilter>
          value={filter}
          onChange={onFilterChange}
          options={messageAuditFilters.map((f) => ({ id: f.id, label: f.label, count: counts[f.id] }))}
        />
      </div>

      <RuntimeStatusStrip agents={agents} statuses={statuses} selectedThreadId={threadId} />

      <div className="min-h-0 flex-1 overflow-auto p-3 flex flex-col gap-2.5">
        {messages.length === 0 ? (
          <div className="m-auto rounded-[var(--radius-tower)] border border-dashed border-tower-border-subtle p-4 text-center text-[12px] text-tower-text-muted">
            No messages in this thread.
          </div>
        ) : visible.length === 0 ? (
          <div className="m-auto rounded-[var(--radius-tower)] border border-dashed border-tower-border-subtle p-4 text-center text-[12px] text-tower-text-muted">
            No messages match this audit filter.
          </div>
        ) : (
          visible.map((message) => (
            <MessageBubble key={message.id} message={message} onReveal={() => onReveal(message.id)} />
          ))
        )}
      </div>

      <CommandComposer
        value={draft}
        onChange={onDraftChange}
        onSend={onSend}
        busy={busy}
        error={sendError}
        showWorkspace={!threadId}
        projectPath={projectPath}
        onProjectPathChange={onProjectPathChange}
        workspaces={workspaces}
      />
    </HudPanel>
  );
}
