"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "@/components/ui/cn";

/* ── Code block with copy button ───────────────────────────── */
function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = useCallback(() => {
    const text = preRef.current?.textContent ?? "";
    void navigator.clipboard.writeText(text);
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }, []);

  return (
    <div className="group relative my-2">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 z-10 rounded-tower border border-tower-border-subtle bg-tower-bg-elevated px-1.5 py-0.5 text-[10px] text-tower-text-secondary transition-colors hover:bg-tower-bg-hover md:opacity-0 md:group-hover:opacity-100"
      >
        {copied ? "已复制" : "复制"}
      </button>
      <pre
        ref={preRef}
        className="overflow-x-auto rounded-tower border border-tower-border-subtle bg-tower-bg-base/60 p-3 font-mono text-[12px] leading-5 text-tower-text-primary [&>code]:bg-transparent [&>code]:p-0 [&>code]:font-mono [&>code]:text-[12px]"
      >
        {children}
      </pre>
    </div>
  );
}

/* ── Markdown component overrides ──────────────────────────── */
const mdComponents: Components = {
  p: ({ children }) => <p className="m-0 mb-2 leading-relaxed last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  del: ({ children }) => <del className="opacity-60">{children}</del>,

  h1: ({ children }) => <h1 className="mt-3 mb-2 text-[15px] font-bold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-3 mb-2 text-[14px] font-bold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-2 mb-1 text-[13px] font-bold first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-2 mb-1 text-[13px] font-semibold first:mt-0">{children}</h4>,
  h5: ({ children }) => <h5 className="mt-1.5 mb-1 text-[12px] font-semibold first:mt-0">{children}</h5>,
  h6: ({ children }) => (
    <h6 className="mt-1.5 mb-1 text-[12px] font-medium text-tower-text-muted first:mt-0">{children}</h6>
  ),

  ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-5">{children}</ol>,
  li: ({ children, className }) => (
    <li className={className === "task-list-item" ? "-ml-5 flex list-none items-start gap-1.5" : undefined}>
      {children}
    </li>
  ),
  input: ({ type, checked }) =>
    type === "checkbox" ? (
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="mt-1 h-3.5 w-3.5 rounded-tower border-tower-border-subtle text-tower-accent-arc pointer-events-none"
      />
    ) : (
      <input type={type} />
    ),

  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-[3px] border-tower-border-energy pl-3 italic text-tower-text-secondary">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-tower-accent-arc hover:underline">
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-tower-border-subtle" />,

  /* Code blocks: pre wraps a <code> child; CodeBlock renders the shell + copy button.
     The inner <code> keeps inline styling, reset by [&>code] above when nested in pre. */
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  code: ({ children }) => (
    <code className="rounded-tower bg-tower-bg-base/60 px-1 py-0.5 font-mono text-[0.85em] text-tower-text-primary">
      {children}
    </code>
  ),

  /* Tables (GFM) */
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="min-w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-tower-bg-elevated">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-tower-border-subtle px-2 py-1 text-left text-[12px] font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-tower-border-subtle px-2 py-1">{children}</td>,
};

export interface MarkdownContentProps {
  content: string;
  className?: string;
}

/** 渲染 agent callback 消息的 markdown 内容。仅用于 origin === "callback" 的消息。 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn("break-words text-[13px] text-tower-text-primary", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={mdComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
