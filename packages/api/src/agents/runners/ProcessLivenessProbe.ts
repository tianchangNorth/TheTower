/**
 * ProcessLivenessProbe — CPU-sampling liveness classifier for CLI child processes.
 *
 * Ported from clowder-ai (packages/api/src/utils/ProcessLivenessProbe.ts), trimmed
 * to TheTower's surface area (no OTel, no cli-supervisor). The core idea is kept:
 * sample process-tree CPU time via `ps -A` so a CLI that is idle-waiting on a busy
 * subprocess (e.g. a long tool call) is NOT misclassified as stuck.
 *
 * States (AgentLivenessSnapshot.state, underscore form per TheTower convention):
 * - active:       output received recently
 * - busy_silent:  no output but CPU time is growing (process is working — extend timeout)
 * - idle_silent:  no output AND CPU is flat (process may be stuck — candidate for auto-kill)
 * - dead:         PID no longer exists
 *
 * Warnings carry a `level` so the registry can distinguish a soft "alive_but_silent"
 * hint (silence >= softWarningMs) from a hard "suspected_stall" (silence >=
 * stallWarningMs, idle_silent, CPU sampling available). On platforms without `ps`
 * (Windows) we cannot tell busy from idle, so suspected_stall is never emitted and
 * the absolute CLI timeout remains the binding constraint (clowder-ai #854).
 */
import { execFile } from "node:child_process";
import type { AgentLivenessSnapshot } from "../../types.js";

export interface ProbeConfig {
  sampleIntervalMs: number;
  softWarningMs: number;
  stallWarningMs: number;
  boundedExtensionFactor: number;
  /** Ignore ps cputime jitter: tiny drift must not keep a silent CLI alive forever. */
  minCpuGrowthMs: number;
}

export const DEFAULT_PROBE_CONFIG: ProbeConfig = {
  sampleIntervalMs: 60_000,
  softWarningMs: 120_000,
  stallWarningMs: 300_000,
  boundedExtensionFactor: 2.0,
  minCpuGrowthMs: 50,
};

/** Parse ps cputime format (mm:ss.SS or h:mm:ss) to milliseconds. */
export function parseCpuTime(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const parts = trimmed.split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return (Number(m) * 60 + Number(s)) * 1000;
  }
  return 0;
}

export class ProcessLivenessProbe {
  readonly config: ProbeConfig;
  private readonly pid: number;
  /** Whether CPU sampling is available (false on Windows — no `ps`). */
  readonly cpuSamplingAvailable: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastActivityAt: number;
  private lastEventType: string | undefined;
  private prevCpuTimeMs = 0;
  private currCpuTimeMs = 0;
  private cpuGrowing = false;
  private sampling = false;
  private pidAlive = true;
  private warningQueue: AgentLivenessSnapshot[] = [];
  private softWarningEmitted = false;
  private stallWarningEmitted = false;

  constructor(pid: number, config?: Partial<ProbeConfig>) {
    this.pid = pid;
    this.config = { ...DEFAULT_PROBE_CONFIG, ...config };
    this.lastActivityAt = Date.now();
    this.cpuSamplingAvailable = process.platform !== "win32";
  }

  /** Notify that output was received — resets silence tracking. */
  notifyActivity(lastEventType?: string): void {
    this.lastActivityAt = Date.now();
    if (lastEventType) this.lastEventType = lastEventType;
    this.softWarningEmitted = false;
    this.stallWarningEmitted = false;
  }

  /** Current liveness state. */
  getState(): AgentLivenessSnapshot["state"] {
    if (!this.pidAlive) return "dead";
    const silenceMs = Date.now() - this.lastActivityAt;
    if (silenceMs < this.config.sampleIntervalMs) return "active";
    return this.cpuGrowing ? "busy_silent" : "idle_silent";
  }

  /** Drain pending warning snapshots. */
  drainWarnings(): AgentLivenessSnapshot[] {
    return this.warningQueue.splice(0);
  }

  /**
   * Final flush for shutdown races: stdout can close before the next generator loop
   * drains a warning queued by an in-flight sample. Wait briefly for that sample to
   * land so callers can drain pending warnings before exit, but do not synthesize
   * new warnings during shutdown.
   */
  async flushPendingWarnings(): Promise<void> {
    const deadline = Date.now() + Math.max(this.config.sampleIntervalMs, 50);
    while (this.sampling && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  /** Whether bounded timeout extension applies (busy_silent). */
  shouldExtendTimeout(): boolean {
    return this.getState() === "busy_silent";
  }

  /** Whether the hard cap (boundedExtensionFactor * timeoutMs) is exceeded. */
  isHardCapExceeded(elapsedMs: number, timeoutMs: number): boolean {
    return elapsedMs >= this.config.boundedExtensionFactor * timeoutMs;
  }

  /** Start periodic CPU sampling. */
  start(): void {
    if (this.timer) return;
    this.sampleOnce();
    this.timer = setInterval(() => this.sampleOnce(), this.config.sampleIntervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private sampleOnce(): void {
    // Guard against concurrent samples — nested async calls (ps→pgrep→ps) can
    // overlap when sampleIntervalMs is shorter than the async chain duration.
    if (this.sampling) return;
    this.sampling = true;

    // Check PID existence first (signal 0 = existence check).
    try {
      process.kill(this.pid, 0);
    } catch {
      this.pidAlive = false;
      this.sampling = false;
      return;
    }

    // Windows: `ps` is not available. Use process.kill(pid, 0) for liveness and
    // skip CPU sampling. cpuGrowing stays false (idle_silent state). suspected_stall
    // is not emitted when !cpuSamplingAvailable, so stall auto-kill won't fire and
    // the absolute CLI_TIMEOUT_MS is the binding constraint.
    if (!this.cpuSamplingAvailable) {
      this.cpuGrowing = false;
      this.emitSilenceWarnings();
      this.sampling = false;
      return;
    }

    // Single ps call to get CPU for process tree (main + direct children).
    // When the CLI runs a tool call (e.g. a test subprocess), the subprocess is
    // busy but the main CLI process is idle-waiting. Without checking children,
    // the probe would misclassify as idle_silent and trigger stall auto-kill.
    execFile("ps", ["-A", "-o", "pid=,ppid=,cputime="], (err, stdout) => {
      if (err) {
        this.pidAlive = false;
        this.sampling = false;
        return;
      }
      let mainCpu = -1;
      let childCpuTotal = 0;
      for (const line of stdout.split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 3) continue;
        const pid = Number(parts[0]);
        const ppid = Number(parts[1]);
        const cpu = parseCpuTime(parts[2]);
        if (pid === this.pid) mainCpu = cpu;
        else if (ppid === this.pid) childCpuTotal += cpu;
      }
      if (mainCpu < 0) {
        this.pidAlive = false;
        this.sampling = false;
        return;
      }
      this.updateCpuSample(mainCpu + childCpuTotal);
    });
  }

  private updateCpuSample(totalCpuMs: number): void {
    this.prevCpuTimeMs = this.currCpuTimeMs;
    this.currCpuTimeMs = totalCpuMs;
    this.cpuGrowing = this.currCpuTimeMs - this.prevCpuTimeMs >= this.config.minCpuGrowthMs;
    this.emitSilenceWarnings();
    this.sampling = false;
  }

  /** Emit soft/stall warnings based on silence duration (shared by all paths). */
  private emitSilenceWarnings(): void {
    const silenceMs = Date.now() - this.lastActivityAt;
    // Only emit suspected_stall when CPU sampling is available. On Windows we
    // can't distinguish idle from busy, so we can't "suspect" a stall.
    if (
      silenceMs >= this.config.stallWarningMs &&
      !this.stallWarningEmitted &&
      this.cpuSamplingAvailable
    ) {
      this.stallWarningEmitted = true;
      this.warningQueue.push(this.makeSnapshot("stall", silenceMs));
    } else if (silenceMs >= this.config.softWarningMs && !this.softWarningEmitted) {
      this.softWarningEmitted = true;
      this.warningQueue.push(this.makeSnapshot("soft", silenceMs));
    }
  }

  private makeSnapshot(level: "soft" | "stall", silenceDurationMs: number): AgentLivenessSnapshot {
    return {
      state: this.getState(),
      silenceDurationMs,
      processAlive: this.pidAlive,
      lastEventType: this.lastEventType,
      checkedAt: Date.now(),
      level,
    };
  }
}
