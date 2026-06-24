import type { Agent, AgentRunner } from "../types.js";
import { MockRunner } from "./runners/MockRunner.js";

export class RunnerRegistry {
  private readonly mockRunner = new MockRunner();

  getRunner(agent: Agent): AgentRunner {
    switch (agent.provider) {
      case "mock":
      case "codex":
      case "claude":
      case "gemini":
      case "openai-api":
      case "custom":
        return this.mockRunner;
    }
  }
}
