"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/components/ui/cn";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[12px] leading-none whitespace-nowrap",
  {
    variants: {
      tone: {
        idle: "bg-tower-bg-hover text-tower-status-idle",
        thinking: "bg-tower-status-thinking/15 text-tower-status-thinking",
        "tool-calling": "bg-tower-status-tool-calling/15 text-tower-status-tool-calling",
        replying: "bg-tower-status-replying/15 text-tower-status-replying",
        done: "bg-tower-status-done/15 text-tower-status-done",
        error: "bg-tower-status-error/15 text-tower-status-error",
        stall: "bg-tower-status-suspected-stall/15 text-tower-status-suspected-stall",
        void: "bg-tower-accent-void/15 text-tower-accent-void",
        info: "bg-tower-bg-hover text-tower-text-secondary",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {}

/** 状态徽章：颜色走 semantic 状态 token，不直接引用 foundation。 */
export function StatusBadge({ tone, className, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)} {...props}>
      {children}
    </span>
  );
}

export { statusBadgeVariants };
