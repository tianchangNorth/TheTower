import { SUPPORTED_AGENT_PROVIDERS } from "@the-tower/shared";
import type { AgentProvider } from "../types.js";

export class UnsupportedProviderError extends Error {
  readonly code = "unsupported_agent_provider";

  constructor(readonly provider: AgentProvider) {
    super(`Agent provider "${provider}" is not supported. Use ${SUPPORTED_AGENT_PROVIDERS.join(", ")}.`);
  }
}

export function assertSupportedProvider(provider: AgentProvider): void {
  if (!SUPPORTED_AGENT_PROVIDERS.includes(provider)) {
    throw new UnsupportedProviderError(provider);
  }
}
