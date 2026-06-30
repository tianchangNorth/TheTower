"use client";

import * as React from "react";
import { cn } from "./cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "min-w-0 h-8 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated px-2 text-[13px] text-tower-text-primary placeholder:text-tower-text-muted outline-none focus-visible:border-tower-border-energy",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
