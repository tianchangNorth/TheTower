"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-tower)] text-[13px] font-medium transition-colors disabled:opacity-60 disabled:pointer-events-none outline-none focus-visible:ring-2 focus-visible:ring-tower-accent-arc/40",
  {
    variants: {
      variant: {
        default:
          "border border-tower-border-energy bg-tower-accent-arc/15 text-tower-accent-arc hover:bg-tower-accent-arc/25",
        solid:
          "border border-tower-accent-arc bg-tower-accent-arc text-tower-bg-base hover:bg-tower-accent-arc/90",
        ghost:
          "border border-transparent text-tower-text-secondary hover:bg-tower-bg-hover hover:text-tower-text-primary",
        outline:
          "border border-tower-border-subtle text-tower-text-primary hover:bg-tower-bg-hover",
        danger:
          "border border-tower-accent-danger/60 text-tower-accent-danger hover:bg-tower-accent-danger/15",
      },
      size: {
        sm: "h-7 px-2 text-[12px]",
        md: "h-8 px-2.5",
        icon: "h-8 w-8 p-0",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
