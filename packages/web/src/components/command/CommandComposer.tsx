"use client";

import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface CommandComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  error?: string;
}

/** 命令输入：textarea + Send + send error + mention chips 占位。workspace 由创建弹窗决定。 */
export function CommandComposer({ value, onChange, onSend, busy, error }: CommandComposerProps) {
  return (
    <div className="grid shrink-0 gap-2 border-t border-tower-border-subtle bg-tower-bg-panel p-2.5">
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
