import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1 text-[11px] text-tower-text-muted", className)}>
      <span className="font-bold uppercase tracking-wide">{label}</span>
      {children}
      {hint ? <span className="text-[10px] text-tower-text-muted">{hint}</span> : null}
    </label>
  );
}
