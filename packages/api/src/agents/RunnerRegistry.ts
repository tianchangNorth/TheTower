import type { Agent, AgentRunner } from "../types.js";
import { ClaudeCliRunner } from "./runners/ClaudeCliRunner.js";
import { CodexCliRunner } from "./runners/CodexCliRunner.js";
import { MockRunner } from "./runners/MockRunner.js";
import { UnsupportedProviderError } from "./ProviderCapabilities.js";

export class RunnerRegistry {
  private readonly mockRunner = new MockRunner();
  private readonly codexRunner = new CodexCliRunner();
  private readonly claudeRunner = new ClaudeCliRunner();

  getRunner(agent: Agent): AgentRunner {
    switch (agent.provider) {
      case "mock":
        return this.mockRunner;
      case "codex":
        return this.codexRunner;
      case "claude":
        return this.claudeRunner;
      case "gemini":
      case "openai-api":
      case "custom":
        throw new UnsupportedProviderError(agent.provider);
    }
  }
}
