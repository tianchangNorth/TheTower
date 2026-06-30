"use client";

import * as React from "react";
import { cn } from "./cn";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-w-0 resize-none rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated p-2 text-[13px] text-tower-text-primary placeholder:text-tower-text-muted outline-none focus-visible:border-tower-border-energy",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
