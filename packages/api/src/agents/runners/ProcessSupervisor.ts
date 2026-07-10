import type { ChildProcess } from "node:child_process";

/** Ensures cancel and timeout use the same TERM → grace period → KILL policy. */
export class ProcessSupervisor {
  private escalationTimer: NodeJS.Timeout | undefined;
  private terminated = false;

  constructor(
    private readonly child: ChildProcess,
    private readonly gracePeriodMs = 5_000,
  ) {
    child.once("close", () => this.dispose());
  }

  terminate(): void {
    if (this.terminated) return;
    this.terminated = true;
    try {
      this.child.kill("SIGTERM");
    } catch {
      this.dispose();
      return;
    }
    this.escalationTimer = setTimeout(() => {
      try {
        this.child.kill("SIGKILL");
      } catch {
        // Process has already exited.
      }
    }, this.gracePeriodMs);
  }

  dispose(): void {
    if (this.escalationTimer) clearTimeout(this.escalationTimer);
    this.escalationTimer = undefined;
  }
}
