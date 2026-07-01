"use client";

import * as React from "react";
import { cn } from "@/components/ui/cn";

export interface SegmentedOption<T extends string> {
  id: T;
  label: React.ReactNode;
  count?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** 分段控制：替代普通按钮组，用于 audit filter / mode 切换等。 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn("flex min-w-0 items-center gap-1.5 overflow-x-auto", className)}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex min-h-7.5 items-center gap-1.5 whitespace-nowrap rounded-tower border px-2 text-[12px]",
              selected
                ? "border-tower-border-energy bg-tower-accent-arc/15 text-tower-accent-arc"
                : "border-tower-border-subtle bg-tower-bg-elevated text-tower-text-secondary hover:bg-tower-bg-hover",
            )}
          >
            <span>{option.label}</span>
            {option.count !== undefined ? (
              <span
                className={cn(
                  "inline-flex min-w-4.5 items-center justify-center rounded-full px-1 text-[11px]",
                  selected ? "bg-tower-accent-arc text-tower-bg-base" : "bg-tower-bg-hover text-tower-text-muted",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
