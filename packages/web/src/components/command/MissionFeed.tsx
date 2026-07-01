"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Activity, Boxes, FolderTree, RefreshCw } from "lucide-react";
import type {
  Agent,
  Message,
  Thread,
} from "@the-tower/shared";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { SegmentedControl } from "@/components/hud/SegmentedControl";
import { Button } from "@/components/ui/button";
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
  messages: Message[];
  filter: MessageAuditFilter;
  onFilterChange: (value: MessageAuditFilter) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  sendError?: string;
  onReveal: (messageId: string) => void;
  onReload: () => void;
}

export function MissionFeed({
  threadId,
  thread,
  agents,
  messages,
  filter,
  onFilterChange,
  draft,
  onDraftChange,
  onSend,
  busy,
  sendError,
  onReveal,
  onReload,
}: MissionFeedProps) {
  const bubbles = useMemo(() => projectMessagesToBubbles(messages), [messages]);
  const counts = useMemo(() => buildMessageAuditCounts(messages), [messages]);
  const visible = useMemo(
    () => bubbles.filter((m) => matchesMessageAuditFilter(m, filter)),
    [bubbles, filter],
  );

  return (
    <HudPanel accent className="min-w-0 flex-1">
      <PanelHeader
        title={thread?.title ?? "Thread"}
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
              <Link
                href={
                  thread?.projectPath
                    ? `/workspaces?projectPath=${encodeURIComponent(thread.projectPath)}`
                    : "/workspaces"
                }
              >
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

      <div className="flex items-center gap-2 border-b border-tower-border-subtle px-2.5 py-1.5">
        <span className="font-mono text-[11px] text-tower-text-muted">
          {thread?.projectPath ?? "No workspace"}
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-tower-border-subtle px-2.5 py-1.5">
        <span className="text-[11px] font-bold uppercase text-tower-text-muted">Audit</span>
        <SegmentedControl<MessageAuditFilter>
          value={filter}
          onChange={onFilterChange}
          options={messageAuditFilters.map((f) => ({ id: f.id, label: f.label, count: counts[f.id] }))}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 flex flex-col gap-2.5">
        {messages.length === 0 ? (
          <div className="m-auto rounded-tower border border-dashed border-tower-border-subtle p-4 text-center text-[12px] text-tower-text-muted">
            No messages in this thread.
          </div>
        ) : visible.length === 0 ? (
          <div className="m-auto rounded-tower border border-dashed border-tower-border-subtle p-4 text-center text-[12px] text-tower-text-muted">
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
        agents={agents}
      />
    </HudPanel>
  );
}
