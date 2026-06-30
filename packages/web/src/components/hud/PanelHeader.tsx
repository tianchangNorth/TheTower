import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export interface PanelHeaderProps {
  icon?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  className?: string;
}

/** 面板分区标题：硬朗、全大写、细底边。 */
export function PanelHeader({ icon, title, action, flush, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 border-b border-tower-border-subtle px-3 text-[13px] font-bold uppercase tracking-wide text-tower-text-secondary",
        flush && "border-b-0",
        className,
      )}
    >
      {icon}
      <span className="truncate">{title}</span>
      {action ? <div className="ml-auto flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
