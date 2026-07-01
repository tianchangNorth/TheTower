import type { ReactNode } from "react";

/** Tab 占位：未完全实现的域用稳定占位 + 后续接口说明。 */
export function Placeholder({ title, note, children }: { title: string; note?: string; children?: ReactNode }) {
  return (
    <div className="grid gap-3">
      <div className="rounded-[var(--radius-tower)] border border-dashed border-tower-border-subtle bg-tower-bg-elevated/40 p-3 text-[12px] text-tower-text-muted">
        <p className="m-0 font-bold uppercase tracking-wide text-tower-text-secondary">{title}</p>
        {note ? <p className="mt-1 m-0">{note}</p> : null}
      </div>
      {children}
    </div>
  );
}
