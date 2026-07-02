"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Terminal, MessageSquare, Boxes, Activity, FolderTree, ListChecks, Settings, Wrench } from "lucide-react";
import { cn } from "@/components/ui/cn";

const items = [
  { href: "/", label: "Command", icon: Terminal },
  { href: "/threads", label: "Threads", icon: MessageSquare },
  { href: "/agents", label: "Agents", icon: Boxes },
  { href: "/capabilities", label: "Capabilities", icon: Wrench },
  { href: "/telemetry", label: "Telemetry", icon: Activity },
  { href: "/workspaces", label: "Workspaces", icon: FolderTree },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

/** 左侧活动导航：常驻于 AppShell，路由变化只改 active 态。 */
export function ActivityNav() {
  const pathname = usePathname();
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-tower-border-subtle bg-tower-bg-elevated py-2">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-[var(--radius-tower)] border transition-colors",
              active
                ? "border-tower-border-energy bg-tower-accent-arc/15 text-tower-accent-arc"
                : "border-transparent text-tower-text-muted hover:bg-tower-bg-hover hover:text-tower-text-primary",
            )}
          >
            <Icon size={18} />
          </Link>
        );
      })}
    </nav>
  );
}
