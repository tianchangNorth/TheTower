"use client";

import { Brain, ChevronRight, Eye, Lock, Terminal, Wrench } from "lucide-react";
import { useState } from "react";
import type { Message } from "@the-tower/shared";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { cn } from "@/components/ui/cn";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { agentAccentClasses } from "@/lib/agentIdentity";
import { getMessageOrigin, getMessageVisibility } from "@/lib/messageAudit";
import { senderLabel } from "@/lib/format";

export interface MessageBubbleProps {
  message: Message;
  onReveal: () => void;
}

/** 消息气泡多态：user / agent / system / private / callback / handoff / stream，靠身份色与状态色区分。 */
export function MessageBubble({ message, onReveal }: MessageBubbleProps) {
  const visibility = getMessageVisibility(message);
  const origin = getMessageOrigin(message);
  const isPrivate = visibility === "private";
  const isCallback = origin === "callback";
  const isStream = origin === "agent_stream";
  const hasThinking = Boolean(message.thinking?.trim());
  const hasCliOutput = isStream && (Boolean(message.toolEvents?.length) || Boolean(message.content.trim()));
  const isHandoff = Boolean(message.handoffPayload);
  const isUser = message.senderType === "user";
  const isSystem = message.senderType === "system";

  const align = isUser ? "self-end" : isSystem ? "self-center" : "self-start";
  const maxW = isSystem ? "max-w-[96%]" : "max-w-[86%]";
  const acc =
    isUser
      ? { text: "text-tower-accent-arc", border: "border-tower-accent-arc/40", bg: "bg-tower-accent-arc/10" }
      : isSystem
        ? { text: "text-tower-text-secondary", border: "border-tower-border-subtle", bg: "bg-tower-bg-elevated" }
        : agentAccentClasses(message.senderId ?? message.senderType);

  return (
    <article
      className={cn(
        "relative flex flex-col gap-1.5 rounded-tower border px-3 py-2",
        align,
        maxW,
        isPrivate
          ? "border-dashed border-tower-accent-void/50 bg-tower-accent-void/5"
          : cn(acc.border, acc.bg),
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
          <strong className={cn("truncate text-[12px] font-bold", acc.text)}>{senderLabel(message)}</strong>
          <StatusBadge tone={isPrivate ? "void" : "info"}>
            {isPrivate ? (
              <>
                <Lock size={11} /> private
              </>
            ) : (
              <>
                <Eye size={11} /> {visibility}
              </>
            )}
          </StatusBadge>
          {isCallback ? <StatusBadge tone="tool-calling">callback</StatusBadge> : null}
          {isHandoff ? <StatusBadge tone="thinking">handoff</StatusBadge> : null}
          {message.revealedAt ? <StatusBadge tone="done">revealed</StatusBadge> : null}
        </div>
        <div className="inline-flex shrink-0 items-center gap-2">
          {isPrivate && !message.revealedAt ? (
            <button
              type="button"
              onClick={onReveal}
              title="Reveal private message"
              className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-tower border border-tower-border-subtle text-tower-text-secondary transition-colors hover:bg-tower-bg-hover"
            >
              <Eye size={13} />
            </button>
          ) : null}
          <time className="font-mono text-[11px] text-tower-text-muted">
            {new Date(message.createdAt).toLocaleTimeString()}
          </time>
        </div>
      </header>

      {isStream ? null : isCallback ? (
        <MarkdownContent content={message.content} />
      ) : (
        <p className="m-0 wrap-anywhere whitespace-pre-wrap text-[13px] text-tower-text-primary">{message.content}</p>
      )}

      {hasThinking ? <ThinkingOutput content={message.thinking ?? ""} /> : null}

      {hasCliOutput ? <CliOutput message={message} /> : null}

      <footer className="flex flex-wrap gap-x-2.25 gap-y-1 text-[11px] text-tower-text-muted">
        <span className="wrap-anywhere">origin: {origin}</span>
        <span className="wrap-anywhere">status: {message.deliveryStatus ?? "delivered"}</span>
        {message.mentions.length > 0 ? (
          <span className="wrap-anywhere">mentions: {message.mentions.join(", ")}</span>
        ) : null}
        {message.visibleToAgentIds && message.visibleToAgentIds.length > 0 ? (
          <span className="wrap-anywhere">visibleTo: {message.visibleToAgentIds.join(", ")}</span>
        ) : null}
      </footer>

      {message.handoffPayload ? <HandoffCard payload={message.handoffPayload} /> : null}
    </article>
  );
}

function ThinkingOutput({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = content.length > 72 ? `${content.slice(0, 72)}...` : content;
  return (
    <details
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
      className="rounded-tower border border-tower-border-subtle bg-tower-bg-base/40 text-[12px]"
    >
      <summary className="flex min-h-8 cursor-pointer items-center gap-2 px-2.25 font-bold text-tower-text-secondary">
        <ChevronRight
          size={13}
          className={cn("shrink-0 transition-transform", expanded ? "rotate-90" : "rotate-0")}
        />
        <Brain size={13} />
        <span>Thinking</span>
        {!expanded ? <span className="min-w-0 truncate text-[11px] font-normal text-tower-text-muted">{preview}</span> : null}
      </summary>
      <div className="border-t border-tower-border-subtle p-2">
        <pre className="m-0 wrap-anywhere whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-tower-text-primary">
          {content}
        </pre>
      </div>
    </details>
  );
}

function CliOutput({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);
  const toolEvents = message.toolEvents ?? [];
  const stdout = message.extra?.stream?.cliStdout ?? message.content;
  const count = toolEvents.length + (stdout.trim() ? 1 : 0);
  return (
    <details
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
      className="rounded-tower border border-tower-border-subtle bg-tower-bg-base/40 text-[12px]"
    >
      <summary className="flex min-h-8 cursor-pointer items-center gap-2 px-2.25 font-bold uppercase text-tower-text-secondary">
        <ChevronRight
          size={13}
          className={cn("shrink-0 transition-transform", expanded ? "rotate-90" : "rotate-0")}
        />
        <Terminal size={13} />
        <span>CLI Output</span>
        <span className="rounded-tower bg-tower-bg-elevated px-1.5 text-[10px] text-tower-text-muted">
          {count} item{count === 1 ? "" : "s"}
        </span>
      </summary>
      <div className="border-t border-tower-border-subtle p-2">
        {toolEvents.length > 0 ? (
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0 font-mono text-[12px]">
            {toolEvents.map((event) => (
              <li key={event.id} className="rounded-tower border border-tower-border-subtle bg-tower-bg-elevated/50 p-2">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase text-tower-text-muted">
                  <Wrench size={11} />
                  <span>{event.type}</span>
                  <span>·</span>
                  <span>{event.label}</span>
                </div>
                {event.detail ? (
                  <pre className="m-0 wrap-anywhere whitespace-pre-wrap text-[12px] text-tower-text-primary">
                    {event.detail}
                  </pre>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
        {stdout.trim() ? (
          <pre className="m-0 mt-2 wrap-anywhere whitespace-pre-wrap font-mono text-[12px] text-tower-text-primary">
            {stdout}
          </pre>
        ) : null}
      </div>
    </details>
  );
}

function HandoffCard({ payload }: { payload: NonNullable<Message["handoffPayload"]> }) {
  return (
    <details className="mt-1 rounded-tower border border-tower-border-subtle bg-tower-bg-base/40 p-2 text-[12px]">
      <summary className="cursor-pointer font-bold text-tower-text-secondary">handoff payload</summary>
      <dl className="mt-1.5 grid grid-cols-[76px_minmax(0,1fr)] gap-x-2 gap-y-1.25">
        <dt className="text-tower-text-muted">from</dt>
        <dd className="m-0 wrap-anywhere text-tower-text-primary">{payload.fromAgentId}</dd>
        <dt className="text-tower-text-muted">to</dt>
        <dd className="m-0 wrap-anywhere text-tower-text-primary">{payload.toAgentIds.join(", ")}</dd>
        <dt className="text-tower-text-muted">what</dt>
        <dd className="m-0 wrap-anywhere text-tower-text-primary">{payload.what}</dd>
        <dt className="text-tower-text-muted">why</dt>
        <dd className="m-0 wrap-anywhere text-tower-text-primary">{payload.why}</dd>
        <dt className="text-tower-text-muted">tradeoff</dt>
        <dd className="m-0 wrap-anywhere text-tower-text-primary">{payload.tradeoff}</dd>
        <dt className="text-tower-text-muted">next</dt>
        <dd className="m-0 wrap-anywhere text-tower-text-primary">{payload.nextAction}</dd>
        {payload.openQuestions.length > 0 ? (
          <>
            <dt className="text-tower-text-muted">questions</dt>
            <dd className="m-0 wrap-anywhere text-tower-text-primary">{payload.openQuestions.join(" | ")}</dd>
          </>
        ) : null}
      </dl>
    </details>
  );
}
