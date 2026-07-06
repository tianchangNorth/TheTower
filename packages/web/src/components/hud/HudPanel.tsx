import * as React from "react";
import { cn } from "@/components/ui/cn";

export interface HudPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 能量边框（激活/选中态）。 */
  accent?: boolean;
  /** 左上角 HUD 角标。 */
  corner?: boolean;
  /** 左缘 2px 发光条：常态微亮，hover 常态亮起（目的地卡片风格）。 */
  edgeGlow?: boolean;
}

/** Destiny 2 风格 HUD 面板：细边框、深色面板、可选能量边框与角标。 */
export function HudPanel({ accent, corner, edgeGlow, className, children, ...props }: HudPanelProps) {
  return (
    <div
      className={cn(
        "relative min-h-0 flex flex-col overflow-hidden rounded-tower border bg-tower-bg-panel",
        accent ? "border-tower-border-energy" : "border-tower-border-subtle",
        corner && "tower-corner",
        edgeGlow && "group",
        className,
      )}
      {...props}
    >
      {edgeGlow ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-0 top-0 h-full w-0.5 bg-tower-accent-arc opacity-0 transition-opacity duration-300",
            "group-hover:opacity-100",
          )}
        />
      ) : null}
      {children}
    </div>
  );
}
