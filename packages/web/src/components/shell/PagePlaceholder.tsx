import type { ReactNode } from "react";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { StatusBadge } from "@/components/hud/StatusBadge";

/** 占位页面：用 HUD primitives 表达路由边界已存在，业务在后续 phase 落地。 */
export function PagePlaceholder({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge?: ReactNode;
}) {
  return (
    <div className="h-full min-h-0 overflow-auto bg-tower-bg-base p-3">
      <HudPanel corner className="h-full">
        <PanelHeader title={title} action={badge ?? <StatusBadge tone="info">planned</StatusBadge>} />
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <p className="max-w-md text-center text-[13px] leading-relaxed text-tower-text-secondary">{description}</p>
        </div>
      </HudPanel>
    </div>
  );
}
