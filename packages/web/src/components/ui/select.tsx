"use client";

import * as React from "react";
import { cn } from "./cn";

/** 原生 select，HUD token 风格。复杂无障碍场景后续可换 Radix Select。 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-8 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated px-2 text-[13px] text-tower-text-primary outline-none focus-visible:border-tower-border-energy",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
