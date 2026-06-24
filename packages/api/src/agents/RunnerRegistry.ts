import type { Agent, AgentRunner } from "../types.js";
import { CodexCliRunner } from "./runners/CodexCliRunner.js";
import { MockRunner } from "./runners/MockRunner.js";

export class RunnerRegistry {
  private readonly mockRunner = new MockRunner();
  private readonly codexRunner = new CodexCliRunner();

  getRunner(agent: Agent): AgentRunner {
    switch (agent.provider) {
      case "mock":
        return this.mockRunner;
      case "codex":
        return this.codexRunner;
      case "claude":
      case "gemini":
      case "openai-api":
      case "custom":
        return this.mockRunner;
    }
  }
}
