"use client";

import { MessageSquare, Plus } from "lucide-react";
import type { Thread } from "@the-tower/shared";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { Button } from "@/components/ui/button";
import { useCreateThread } from "@/hooks/useCreateThread";
import { ThreadListItem } from "./ThreadListItem";

export interface ThreadNavigatorProps {
  threads: Thread[];
  selectedThreadId?: string;
  onSelect: (threadId: string) => void;
  onDelete: (threadId: string) => void;
}

export function ThreadNavigator({
  threads,
  selectedThreadId,
  onSelect,
  onDelete,
}: ThreadNavigatorProps) {
  const openCreateThread = useCreateThread();
  return (
    <HudPanel corner className="w-[250px] shrink-0">
      <PanelHeader
        title="Threads"
        icon={<MessageSquare size={15} />}
        action={
          <Button size="sm" variant="ghost" onClick={openCreateThread}>
            <Plus size={14} />
            New
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-auto p-2 grid content-start gap-1.5">
        {threads.length === 0 ? (
          <p className="m-auto text-[12px] text-tower-text-muted">No threads.</p>
        ) : (
          threads.map((thread) => (
            <ThreadListItem
              key={thread.id}
              thread={thread}
              selected={thread.id === selectedThreadId}
              onSelect={() => onSelect(thread.id)}
              onDelete={() => onDelete(thread.id)}
            />
          ))
        )}
      </div>
    </HudPanel>
  );
}
