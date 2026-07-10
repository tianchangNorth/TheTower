"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Square } from "lucide-react";
import type { Agent } from "@the-tower/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/cn";
import { agentAccentClasses } from "@/lib/agentIdentity";
import { detectMentionQuery } from "@/lib/mention";

export interface CommandComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  running: boolean;
  stopping: boolean;
  error?: string;
  agents: Agent[];
}

interface PopupState {
  at: number;
  query: string;
  highlightIndex: number;
}

/** 命令输入：textarea + Send + send error + @mention 补全。 */
export function CommandComposer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  running,
  stopping,
  error,
  agents,
}: CommandComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const composingRef = useRef(false);

  const enabledAgents = useMemo(() => agents.filter((a) => a.enabled), [agents]);

  const candidates = useMemo(() => {
    if (!popup) return [] as Agent[];
    const q = popup.query.toLowerCase();
    return enabledAgents.filter((a) => {
      const handles = a.mentionHandles.map((h) => h.toLowerCase());
      return handles.some((h) => h.includes(q)) || a.displayName.toLowerCase().includes(q);
    });
  }, [popup, enabledAgents]);

  // 候选缩水时收束 highlight；清空则关弹窗
  useEffect(() => {
    if (!popup) return;
    if (candidates.length === 0) {
      setPopup(null);
      return;
    }
    if (popup.highlightIndex >= candidates.length) {
      setPopup({ ...popup, highlightIndex: 0 });
    }
  }, [candidates, popup]);

  const recomputePopup = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta || composingRef.current) {
      setPopup(null);
      return;
    }
    const caret = ta.selectionStart ?? 0;
    const detected = detectMentionQuery(value, caret);
    if (!detected) {
      setPopup(null);
      return;
    }
    setPopup((prev) => ({
      at: detected.at,
      query: detected.query,
      highlightIndex: prev && prev.at === detected.at ? prev.highlightIndex : 0,
    }));
  }, [value]);

  const insertMention = useCallback(
    (agent: Agent) => {
      const ta = textareaRef.current;
      if (!ta || !popup) return;
      const caret = ta.selectionStart ?? ta.value.length;
      const handle = agent.mentionHandles[0] ?? `@${agent.id}`;
      const next = value.slice(0, popup.at) + handle + " " + value.slice(caret);
      const caretNext = popup.at + handle.length + 1;
      onChange(next);
      setPopup(null);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(caretNext, caretNext);
      });
    },
    [onChange, popup, value],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (popup && candidates.length > 0) {
        const last = candidates.length - 1;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setPopup({ ...popup, highlightIndex: popup.highlightIndex >= last ? 0 : popup.highlightIndex + 1 });
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setPopup({ ...popup, highlightIndex: popup.highlightIndex <= 0 ? last : popup.highlightIndex - 1 });
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const picked = candidates[popup.highlightIndex];
          if (picked) insertMention(picked);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setPopup(null);
          return;
        }
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (running) return;
        onSend();
      }
    },
    [popup, candidates, insertMention, onSend, running],
  );

  return (
    <div className="grid shrink-0 gap-2 border-t border-tower-border-subtle bg-tower-bg-panel p-2.5">
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2">
        <div className="relative min-w-0">
          <Textarea
            ref={textareaRef}
            rows={3}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              requestAnimationFrame(recomputePopup);
            }}
            onKeyUp={recomputePopup}
            onClick={recomputePopup}
            onSelect={recomputePopup}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={(event) => {
              composingRef.current = false;
              onChange((event.target as HTMLTextAreaElement).value);
              requestAnimationFrame(recomputePopup);
            }}
            placeholder="向 Agent 下达指令…  输入 @ 触发补全"
            className="block h-full min-h-21.5 w-full"
          />
          {popup && candidates.length > 0 ? (
            <MentionPopup
              candidates={candidates}
              highlightIndex={popup.highlightIndex}
              onPick={insertMention}
            />
          ) : null}
        </div>
        <Button
          variant={running ? "danger" : "solid"}
          onClick={running ? onStop : onSend}
          disabled={running ? stopping : busy || !value.trim()}
          className="h-full px-3"
        >
          {running ? <Square size={15} /> : <Send size={16} />}
          {running ? (stopping ? "Stopping" : "Stop") : "Send"}
        </Button>
      </div>
      {error ? <p className="text-[11px] text-tower-accent-danger">{error}</p> : null}
    </div>
  );
}

function MentionPopup({
  candidates,
  highlightIndex,
  onPick,
}: {
  candidates: Agent[];
  highlightIndex: number;
  onPick: (agent: Agent) => void;
}) {
  return (
    <ul
      role="listbox"
      className="absolute bottom-full left-0 z-20 mb-1 max-h-52 w-72 overflow-auto rounded-tower border border-tower-border-subtle bg-tower-bg-elevated p-1 shadow-lg"
    >
      {candidates.map((agent, i) => {
        const acc = agentAccentClasses(agent.id);
        const active = i === highlightIndex;
        return (
          <li key={agent.id} role="option" aria-selected={active}>
            <button
              type="button"
              onClick={() => onPick(agent)}
              className={cn(
                "flex w-full items-center gap-2 rounded-tower px-2 py-1.5 text-left text-[12px]",
                active ? "bg-tower-bg-hover" : "hover:bg-tower-bg-hover",
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", acc.solid)} />
              <span className="truncate text-tower-text-primary">{agent.displayName}</span>
              <span className="ml-auto truncate font-mono text-[11px] text-tower-text-muted">
                {agent.mentionHandles[0]}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
