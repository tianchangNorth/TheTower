import * as React from "react";
import { cn } from "@/components/ui/cn";

export interface HudPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 能量边框（激活/选中态）。 */
  accent?: boolean;
  /** 左上角 HUD 角标。 */
  corner?: boolean;
}

/** Destiny 2 风格 HUD 面板：细边框、深色面板、可选能量边框与角标。 */
export function HudPanel({ accent, corner, className, ...props }: HudPanelProps) {
  return (
    <div
      className={cn(
        "relative min-h-0 flex flex-col overflow-hidden rounded-[var(--radius-tower)] border bg-tower-bg-panel",
        accent ? "border-tower-border-energy" : "border-tower-border-subtle",
        corner && "tower-corner",
        className,
      )}
      {...props}
    />
  );
}
