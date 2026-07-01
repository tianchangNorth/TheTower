"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Plus, Boxes, Activity, FolderTree, ListChecks, Settings } from "lucide-react";
import { animate, stagger } from "animejs";
import type { Agent, AgentRuntimeStatus, Thread } from "@the-tower/shared";
import { useThreads } from "@/hooks/useThreads";
import { useAgents } from "@/hooks/useAgents";
import { useThreadRuntime } from "@/hooks/useThreadRuntime";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useCreateThread } from "@/hooks/useCreateThread";
import { useSseStore } from "@/stores/sseStore";
import { DestinyEmblem } from "./DestinyEmblem";
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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const els = root.querySelectorAll<HTMLElement>("[data-anim]");
    if (els.length) {
      animate(els, {
        translateY: [16, 0],
        opacity: [0, 1],
        delay: stagger(80),
        duration: 600,
        ease: "easeOutQuad",
      });
    }
  }, []);

  const enabledAgents = agents.filter((a) => a.enabled);
  const runningCount = enabledAgents.filter((a) => isRunning(runtime.statuses[a.id])).length;
  const recentThreads = threads.slice(0, 6);

  const quickLinks = [
    { href: "/agents", label: "Agents", icon: Boxes },
    { href: "/telemetry", label: "Telemetry", icon: Activity },
    { href: "/workspaces", label: "Workspaces", icon: FolderTree },
    { href: "/tasks", label: "Tasks", icon: ListChecks },
    { href: "/settings", label: "Settings", icon: Settings },
  ] as const;

  return (
    <main ref={rootRef} className="h-full min-h-0 overflow-auto bg-tower-bg-base p-4">
      <div className="mx-auto grid max-w-[1400px] gap-4">
        {/* Hero */}
        <section
          data-anim
          className="relative flex flex-col items-center gap-4 overflow-hidden rounded-tower border border-tower-border-subtle bg-tower-bg-elevated p-6 md:flex-row md:items-center md:gap-8"
        >
          <DestinyEmblem className="h-28 w-28 shrink-0 drop-shadow-[0_0_12px_rgba(143,185,255,0.35)]" />
          <div className="flex flex-1 flex-col items-center text-center md:items-start md:text-left">
            <h1 className="m-0 text-[24px] font-bold tracking-wide text-tower-text-primary">
              TheTower
            </h1>
            <p className="m-0 mt-1 text-[13px] text-tower-text-secondary">
              多 Agent 通信内核 · 命令工作台
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 md:justify-start">
              <StatusBadge tone="done">{enabledAgents.length} agents</StatusBadge>
              <StatusBadge tone="info">{threads.length} threads</StatusBadge>
              <StatusBadge tone={runningCount > 0 ? "thinking" : "info"}>
                {runningCount} running
              </StatusBadge>
              <StatusBadge tone={sse === "connected" ? "done" : sse === "error" ? "error" : "stall"}>
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
          <HudPanel corner data-anim className="min-h-0">
            <PanelHeader
              title="Recent threads"
              action={
                <Button size="sm" variant="ghost" onClick={openCreateThread}>
                  <Plus size={13} /> New
                </Button>
              }
            />
            <div className="min-h-0 flex-1 overflow-auto p-2.5">
              {recentThreads.length === 0 ? (
                <p className="m-auto p-4 text-center text-[12px] text-tower-text-muted">
                  No threads yet — click <strong className="text-tower-text-secondary">New thread</strong> to start.
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
          <HudPanel corner data-anim className="min-h-0">
            <PanelHeader title="Agents" />
            <div className="min-h-0 flex-1 overflow-auto p-2.5">
              {enabledAgents.length === 0 ? (
                <p className="m-auto p-4 text-[12px] text-tower-text-muted">No enabled agents.</p>
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
        <section data-anim>
          <h2 className="m-0 mb-2 text-[11px] font-bold uppercase tracking-wide text-tower-text-muted">
            Quick links
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
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

        <p data-anim className="text-center text-[11px] text-tower-text-muted">
          {workspaces.length} trusted workspace{workspaces.length === 1 ? "" : "s"} ·
          <Link href="/settings" className="ml-1 text-tower-accent-arc hover:underline">
            settings
          </Link>
        </p>
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
