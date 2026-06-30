"use client";

import * as React from "react";
import { cn } from "@/components/ui/cn";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 危险动作（删除）使用 danger 色高亮 hover。 */
  danger?: boolean;
}

/** 图标按钮：方角 HUD 风格，默认 ghost，可选 danger hover。 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, danger, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-tower)] border border-transparent text-tower-text-secondary transition-colors hover:bg-tower-bg-hover hover:text-tower-text-primary",
        danger && "hover:text-tower-accent-danger hover:border-tower-accent-danger/40 hover:bg-tower-accent-danger/15",
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";
