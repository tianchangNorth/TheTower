"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Plus, Boxes, Activity, FolderTree, ListChecks, MessageSquare, Settings } from "lucide-react";
import { animate, type Target } from "animejs";
import type { Agent, AgentRuntimeStatus, Thread } from "@the-tower/shared";
import { useThreads } from "@/hooks/useThreads";
import { useAgents } from "@/hooks/useAgents";
import { useThreadRuntime } from "@/hooks/useThreadRuntime";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useCreateThread } from "@/hooks/useCreateThread";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useSseStore } from "@/stores/sseStore";
import { flavor } from "@/lib/homeFlavor";
import { DestinyEmblem } from "./DestinyEmblem";
import { LightDust } from "./LightDust";
import { ReadyIndicator } from "./ReadyIndicator";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { StatusBadge } from "@/components/hud/StatusBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { workspaceLabel } from "@/lib/format";

function isRunning(status: AgentRuntimeStatus | undefined): boolean {
  return Boolean(status && status.status !== "idle" && status.status !== "done");
}

export function HomePage() {
  const { threads } = useThreads();
  const { agents } = useAgents();
  const runtime = useThreadRuntime();
  const { workspaces } = useWorkspaces();
  const openCreateThread = useCreateThread();
  const sse = useSseStore((s) => s.status);
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  // 入场时序：光尘(400)→Hero 文字(600)→卡片(900+)→就绪(1500)
  // 光尘/就绪各自组件内部自驱；此处只负责 Hero 文字/卡片/底部 workspaces 行。
  // 注意：data-anim 只挂在文字层 wrapper 上，不罩背景层（光尘），
  // 否则父级 opacity 闸门会压住背景层的自驱级联时序。
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;
    const els = root.querySelectorAll<HTMLElement>("[data-anim]");
    if (!els.length) return;
    const a = animate(els, {
      translateY: [16, 0],
      opacity: [0, 1],
      delay: (el?: Target) => Number((el as HTMLElement | undefined)?.dataset?.animDelay ?? 0),
      duration: 600,
      ease: "outQuad",
    });
    return () => {
      a.pause();
    };
  }, [reduced]);

  const enabledAgents = agents.filter((a) => a.enabled);
  const runningCount = enabledAgents.filter((a) => isRunning(runtime.statuses[a.id])).length;
  const recentThreads = threads.slice(0, 6);

  const quickLinks = [
    { href: "/threads", label: "Threads", icon: MessageSquare },
    { href: "/agents", label: "Agents", icon: Boxes },
    { href: "/telemetry", label: "Telemetry", icon: Activity },
    { href: "/workspaces", label: "Workspaces", icon: FolderTree },
    { href: "/tasks", label: "Tasks", icon: ListChecks },
    { href: "/settings", label: "Settings", icon: Settings },
  ] as const;

  return (
    <main ref={rootRef} className="h-full min-h-0 overflow-auto bg-tower-bg-base p-4">
      <div className="mx-auto grid max-w-350 gap-4">
        {/* Hero */}
        <section className="relative flex flex-col items-center gap-4 overflow-hidden rounded-tower border border-tower-border-subtle bg-tower-bg-elevated p-6 md:flex-row md:items-center md:gap-8">
          {/* 背景层：光尘局限在 Hero overflow-hidden 内，不挂 data-anim。 */}
          <LightDust />

          <DestinyEmblem className="relative z-10 h-28 w-28 shrink-0 drop-shadow-[0_0_12px_rgba(143,185,255,0.35)]" />
          {/* 文字层 wrapper：data-anim 挂这里，opacity 闸门只罩文字，不压背景层 */}
          <div
            data-anim
            data-anim-delay="600"
            className="relative z-10 flex flex-1 flex-col items-center text-center md:items-start md:text-left"
          >
            <h1 className="m-0 text-[24px] font-bold tracking-[0.12em] text-tower-text-primary">
              TheTower
            </h1>
            <p className="m-0 mt-1 text-[13px] text-tower-text-secondary">
              多 Agent 通信内核 · 命令工作台
            </p>
            <p className="m-0 mt-0.5 text-[12px] italic text-tower-text-muted">
              {flavor("heroLine")}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 md:justify-start">
              <StatusBadge tone="done">{enabledAgents.length} agents</StatusBadge>
              <StatusBadge tone="info">{threads.length} threads</StatusBadge>
              <StatusBadge tone={runningCount > 0 ? "thinking" : "info"}>
                {runningCount} running
              </StatusBadge>
              <StatusBadge tone={sse === "synced" ? "done" : sse === "stale" ? "error" : "stall"}>
                SSE {sse}
              </StatusBadge>
            </div>
            <Button
              variant="solid"
              size="md"
              className="mt-4 self-center md:self-start"
              onClick={openCreateThread}
            >
              <Plus size={15} />
              New thread
            </Button>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* Recent threads */}
          <HudPanel corner edgeGlow data-anim data-anim-delay="900" className="min-h-0">
            <PanelHeader
              title="Recent threads"
              subtitle={flavor("recentThreadsSubtitle")}
              action={
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" asChild>
                    <Link href="/threads">View all</Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={openCreateThread}>
                    <Plus size={13} /> New
                  </Button>
                </div>
              }
            />
            <div className="min-h-0 flex-1 overflow-auto p-2.5">
              {recentThreads.length === 0 ? (
                <p className="m-auto p-4 text-center text-[12px] italic text-tower-text-muted">
                  {flavor("threadsEmpty")}{" "}
                  <span className="not-italic text-tower-text-secondary">
                    点击 <strong>New thread</strong> 开始。
                  </span>
                </p>
              ) : (
                <ul className="m-0 grid gap-1.5">
                  {recentThreads.map((t) => (
                    <ThreadRow key={t.id} thread={t} />
                  ))}
                </ul>
              )}
            </div>
          </HudPanel>

          {/* Agents overview */}
          <HudPanel corner edgeGlow data-anim data-anim-delay="1000" className="min-h-0">
            <PanelHeader title="Agents" subtitle={flavor("agentsSubtitle")} />
            <div className="min-h-0 flex-1 overflow-auto p-2.5">
              {enabledAgents.length === 0 ? (
                <p className="m-auto p-4 text-center text-[12px] italic text-tower-text-muted">
                  {flavor("agentsEmpty")}
                </p>
              ) : (
                <ul className="m-0 grid gap-1">
                  {enabledAgents.map((a) => {
                    const st = runtime.statuses[a.id];
                    const running = isRunning(st);
                    return (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded-tower border border-tower-border-subtle bg-tower-bg-panel px-2 py-1.5 text-[12px]"
                      >
                        <span className="truncate text-tower-text-primary">{a.displayName}</span>
                        <StatusBadge tone={running ? "thinking" : "idle"}>
                          {st?.status ?? "idle"}
                        </StatusBadge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </HudPanel>
        </div>

        {/* Quick links */}
        <section data-anim data-anim-delay="1100">
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="m-0 text-[11px] font-bold uppercase tracking-wide text-tower-text-muted">
              Quick links
            </h2>
            <span className="text-[11px] italic text-tower-text-muted">
              {flavor("quickLinksTitle")}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {quickLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex flex-col items-center gap-2 rounded-tower border border-tower-border-subtle bg-tower-bg-elevated p-4 transition-colors hover:border-tower-border-energy hover:bg-tower-bg-hover"
              >
                <Icon size={22} className="text-tower-accent-arc" />
                <span className="text-[12px] text-tower-text-secondary group-hover:text-tower-text-primary">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <p data-anim data-anim-delay="1400" className="text-center text-[11px] text-tower-text-muted">
          {workspaces.length} trusted workspace{workspaces.length === 1 ? "" : "s"} ·
          <Link href="/settings" className="ml-1 text-tower-accent-arc hover:underline">
            settings
          </Link>
        </p>

        {/* 底部就绪指示 */}
        <ReadyIndicator running={runningCount} sse={sse} />
      </div>
    </main>
  );
}

function ThreadRow({ thread }: { thread: Thread }) {
  return (
    <li>
      <Link
        href={`/threads/${thread.id}`}
        className={cn(
          "block rounded-tower border border-tower-border-subtle bg-tower-bg-panel p-2.5 transition-colors hover:border-tower-border-energy hover:bg-tower-bg-hover",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <strong className="truncate text-[13px] text-tower-text-primary">{thread.title}</strong>
          <StatusBadge tone={thread.mode === "play" ? "done" : "info"}>
            {thread.mode ?? "debug"}
          </StatusBadge>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-tower-text-muted">
          <span className="truncate font-mono">{workspaceLabel(thread.projectPath)}</span>
          <time>{new Date(thread.updatedAt).toLocaleString()}</time>
        </div>
      </Link>
    </li>
  );
}
