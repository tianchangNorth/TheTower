import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AgentRunInput } from "../../types.js";

export const DEFAULT_CALLBACK_BASE_URL = "http://127.0.0.1:3001";

export interface CallbackRuntimeEnvOptions {
  apiBaseUrl?: string;
  env?: NodeJS.ProcessEnv;
}

export function resolveCallbackBaseUrl(options: CallbackRuntimeEnvOptions = {}): string {
  const env = options.env ?? process.env;
  return (
    options.apiBaseUrl ??
    env.THE_TOWER_API_URL ??
    process.env.THE_TOWER_API_URL ??
    DEFAULT_CALLBACK_BASE_URL
  );
}

export function buildCallbackRuntimeEnv(input: AgentRunInput, apiBaseUrl: string): Record<string, string> {
  return {
    THE_TOWER_API_URL: apiBaseUrl,
    THE_TOWER_AGENT_ID: input.agent.id,
    THE_TOWER_THREAD_ID: input.threadId,
    THE_TOWER_INVOCATION_ID: input.invocationId,
    THE_TOWER_CALLBACK_TOKEN: input.callbackToken,
  };
}

export function defaultMcpServerLauncher(env: NodeJS.ProcessEnv = process.env): { command: string; args: string[] } {
  const projectRoot = env.PROJECT_ROOT ?? resolve(process.cwd(), "../..");
  const distPath = resolve(projectRoot, "packages/mcp-server/dist/index.js");
  if (existsSync(distPath)) return { command: "node", args: [distPath] };

  const packageTsxPath = resolve(projectRoot, "packages/mcp-server/node_modules/.bin/tsx");
  if (existsSync(packageTsxPath)) {
    return {
      command: packageTsxPath,
      args: [resolve(projectRoot, "packages/mcp-server/src/index.ts")],
    };
  }

  return {
    command: resolve(projectRoot, "node_modules/.bin/tsx"),
    args: [resolve(projectRoot, "packages/mcp-server/src/index.ts")],
  };
}

export function toTomlString(value: string): string {
  return JSON.stringify(value);
}
