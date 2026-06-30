import type { ReactNode } from "react";
import { TopCommandBar } from "./TopCommandBar";
import { ActivityNav } from "./ActivityNav";

/**
 * 常驻 Shell：顶部指挥栏 + 左侧活动导航 + 内容区。
 * 在 root layout 中渲染，跨路由不重挂载；路由变化只改变内容区与 active 态。
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <TopCommandBar />
      <div className="flex min-h-0 flex-1">
        <ActivityNav />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
