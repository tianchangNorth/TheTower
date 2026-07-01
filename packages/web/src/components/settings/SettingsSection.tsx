import type { ReactNode } from "react";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { cn } from "@/components/ui/cn";

export function SettingsSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <HudPanel corner className={cn("min-h-0", className)}>
      <PanelHeader title={title} action={action} />
      <div className="grid content-start gap-2 p-2.5 text-[12px]">{children}</div>
    </HudPanel>
  );
}
