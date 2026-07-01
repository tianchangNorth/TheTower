"use client";

import { Send } from "lucide-react";
import type { Workspace } from "@the-tower/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export interface CommandComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  error?: string;
  showWorkspace: boolean;
  projectPath: string;
  onProjectPathChange: (value: string) => void;
  workspaces: Workspace[];
}

/** 命令输入：textarea + Send，新 thread 时提示 workspace，mention chips 占位。 */
export function CommandComposer({
  value,
  onChange,
  onSend,
  busy,
  error,
  showWorkspace,
  projectPath,
  onProjectPathChange,
  workspaces,
}: CommandComposerProps) {
  return (
    <div className="grid shrink-0 gap-2 border-t border-tower-border-subtle bg-tower-bg-panel p-2.5">
      {showWorkspace ? (
        <label className="grid gap-1 text-[11px] text-tower-text-muted">
          Working directory
          <Input
            list="workspace-paths"
            value={projectPath}
            onChange={(event) => onProjectPathChange(event.target.value)}
            placeholder="/path/to/project"
          />
          <datalist id="workspace-paths">
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.projectPath}>
                {workspace.name}
              </option>
            ))}
          </datalist>
        </label>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2">
        <Textarea
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onSend();
          }}
          placeholder="向 Agent 下达指令…"
          className="min-h-21.5"
        />
        <Button variant="solid" onClick={onSend} disabled={busy || !value.trim()} className="h-full px-3">
          <Send size={16} />
          Send
        </Button>
      </div>
      {error ? <p className="text-[11px] text-tower-accent-danger">{error}</p> : null}
      <p className="text-[11px] text-tower-text-muted">mention chips 占位：@agent · /handoff · /review</p>
    </div>
  );
}
