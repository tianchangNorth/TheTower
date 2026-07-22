import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Database from "better-sqlite3";
import { buildApp } from "../../src/app.js";
import { createAppContext } from "../../src/bootstrap.js";
import { observeStreamStorage } from "../../src/observability/StreamStorageReport.js";
import type { Agent, Message } from "../../src/types.js";

const enabled = process.env.THE_TOWER_REAL_E2E === "1";
const providerNames = (process.env.THE_TOWER_REAL_E2E_PROVIDERS ?? "codex,claude")
  .split(",")
  .map((value) => value.trim())
  .filter((value): value is "codex" | "claude" => value === "codex" || value === "claude");
const timeoutMs = Number(process.env.THE_TOWER_REAL_E2E_TIMEOUT_MS ?? 300_000);
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const reportDir = resolve(process.env.THE_TOWER_ACCEPTANCE_REPORT_DIR ?? join(rootDir, "test-results/real-a2a"));

test(
  "real Codex and Claude runners preserve A2A stream/callback/play/debug isolation",
  { skip: !enabled, timeout: timeoutMs * Math.max(1, providerNames.length) + 30_000 },
  async (t) => {
    assert.ok(providerNames.length > 0, "THE_TOWER_REAL_E2E_PROVIDERS must contain codex and/or claude");
    mkdirSync(reportDir, { recursive: true });
    for (const provider of providerNames) {
      await t.test(provider, { timeout: timeoutMs + 20_000 }, async () => {
        await runProviderAcceptance(provider);
      });
    }
  },
);

test("acceptance marker evidence is scoped to the expected message origin", () => {
  const messages = [
    { origin: "user" as const, content: "R08_PRIVATE_TEST R08_STREAM_TEST" },
    { origin: "callback" as const, content: "R08_PRIVATE_TEST" },
    { origin: "agent_stream" as const, content: "R08_STREAM_TEST" },
  ];

  assert.equal(hasOriginMarker(messages.slice(0, 1), "callback", "R08_PRIVATE_TEST"), false);
  assert.equal(hasOriginMarker(messages.slice(0, 1), "agent_stream", "R08_STREAM_TEST"), false);
  assert.equal(hasOriginMarker(messages, "callback", "R08_PRIVATE_TEST"), true);
  assert.equal(hasOriginMarker(messages, "agent_stream", "R08_STREAM_TEST"), true);
});

async function runProviderAcceptance(provider: "codex" | "claude"): Promise<void> {
  const model = acceptanceModel(provider);
  const workspaceRoot = join(reportDir, "workspaces");
  mkdirSync(workspaceRoot, { recursive: true });
  const workspace = mkdtempSync(join(workspaceRoot, `the-tower-real-${provider}-`));
  const database = new Database(":memory:");
  const port = await reservePort();
  const apiBaseUrl = `http://127.0.0.1:${port}`;
  const markers = {
    stream: `R08_STREAM_${provider.toUpperCase()}`,
    private: `R08_PRIVATE_${provider.toUpperCase()}`,
    public: `R08_PUBLIC_${provider.toUpperCase()}`,
  };
  const env = captureEnv([
    "PROJECT_ROOT",
    "THE_TOWER_API_URL",
    "THE_TOWER_PROJECT_ALLOWED_ROOTS",
    "CODEX_RUNNER_TIMEOUT_MS",
    "CLAUDE_RUNNER_TIMEOUT_MS",
  ]);
  Object.assign(process.env, {
    PROJECT_ROOT: rootDir,
    THE_TOWER_API_URL: apiBaseUrl,
    THE_TOWER_PROJECT_ALLOWED_ROOTS: workspace,
    CODEX_RUNNER_TIMEOUT_MS: String(timeoutMs),
    CLAUDE_RUNNER_TIMEOUT_MS: String(timeoutMs),
  });

  const context = createAppContext({ database, projectRoot: rootDir, agents: acceptanceAgents(provider, model) });
  const app = await buildApp(context, false);
  let report: Record<string, unknown> = { provider, model: model || "(provider CLI default)", markers, apiBaseUrl };
  try {
    await app.listen({ host: "127.0.0.1", port });
    const thread = await jsonRequest<{ thread: { id: string } }>(`${apiBaseUrl}/api/threads`, {
      method: "POST",
      body: JSON.stringify({ title: `R0.8 ${provider} isolation`, mode: "play", projectPath: workspace }),
    });
    const started = await jsonRequest<{ invocationId: string }>(`${apiBaseUrl}/api/messages`, {
      method: "POST",
      body: JSON.stringify({
        threadId: thread.thread.id,
        targetAgents: ["source"],
        routeMode: "single",
        content: acceptancePrompt(markers),
      }),
    });
    const terminalStatus = await waitForTerminal(context, started.invocationId, timeoutMs);
    const messages = context.stores.messageStore.listByInvocation({
      threadId: thread.thread.id,
      invocationId: started.invocationId,
      limit: 100,
    });
    const providerFailure = messages.find((message) => message.origin === "system")?.content;
    const explicitCallbacks = messages.filter(
      (message) => message.origin === "callback" && message.extra?.isExplicitPost === true,
    );
    const stream = messages.find((message) => message.origin === "agent_stream" && message.senderId === "source");
    const privateCallback = explicitCallbacks.find((message) => message.content.includes(markers.private));
    const publicCallback = explicitCallbacks.find((message) => message.content.includes(markers.public));
    const playObserver = await agentContext(apiBaseUrl, thread.thread.id, "observer");
    const playOutsider = await agentContext(apiBaseUrl, thread.thread.id, "outsider");
    await jsonRequest(`${apiBaseUrl}/api/threads/${thread.thread.id}`, {
      method: "PATCH",
      body: JSON.stringify({ mode: "debug" }),
    });
    const debugObserver = await agentContext(apiBaseUrl, thread.thread.id, "observer");
    const debugOutsider = await agentContext(apiBaseUrl, thread.thread.id, "outsider");
    const storage = observeStreamStorage(database);
    const checks = {
      invocationDone: terminalStatus === "done",
      streamMarkerPersisted: stream?.content.includes(markers.stream) === true,
      noImplicitCallback: messages
        .filter((message) => message.origin === "callback")
        .every((message) => message.extra?.isExplicitPost === true),
      callbacksDoNotContainStreamMarker: explicitCallbacks.every((message) => !message.content.includes(markers.stream)),
      privateCallbackExplicit:
        privateCallback?.visibility === "private" &&
        privateCallback.visibleToAgentIds?.includes("observer") === true &&
        privateCallback.visibleToAgentIds?.includes("source") === true,
      publicCallbackExplicit: publicCallback?.visibility === "public",
      playHidesStream: !hasOrigin(playObserver, "agent_stream") && !hasOrigin(playOutsider, "agent_stream"),
      playPrivateRecipientOnly:
        hasOriginMarker(playObserver, "callback", markers.private) &&
        !hasOriginMarker(playOutsider, "callback", markers.private),
      debugSharesStdout:
        hasOriginMarker(debugObserver, "agent_stream", markers.stream) &&
        hasOriginMarker(debugOutsider, "agent_stream", markers.stream),
      debugRedactsThinking: [...debugObserver, ...debugOutsider]
        .filter((message) => message.origin === "agent_stream" && message.senderId === "source")
        .every((message) => !message.thinking),
      streamRowCompacted: storage.summary.maxRowsPerGroup <= 1 && storage.breaches.length === 0,
    };
    report = {
      ...report,
      generatedAt: new Date().toISOString(),
      threadId: thread.thread.id,
      invocationId: started.invocationId,
      terminalStatus,
      providerFailure,
      checks,
      messageEvidence: messages.map(toEvidence),
      playObserverContext: playObserver.map(toEvidence),
      playOutsiderContext: playOutsider.map(toEvidence),
      debugObserverContext: debugObserver.map(toEvidence),
      debugOutsiderContext: debugOutsider.map(toEvidence),
      streamStorage: storage,
    };
    writeReport(provider, report);
    if (terminalStatus !== "done") {
      throw new Error(`${provider} invocation ${terminalStatus}: ${providerFailure ?? "no provider error message"}`);
    }
    for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, `${provider}: ${name}`);
  } catch (error) {
    report = { ...report, generatedAt: new Date().toISOString(), error: (error as Error).stack ?? String(error) };
    writeReport(provider, report);
    throw error;
  } finally {
    await app.close();
    database.close();
    restoreEnv(env);
    rmSync(workspace, { recursive: true, force: true });
  }
}

function acceptancePrompt(markers: { stream: string; private: string; public: string }): string {
  return [
    "R0.8 deterministic acceptance protocol. Follow every step exactly and do not delegate.",
    `1. Keep ${markers.stream} only in your normal final stdout; never put it in a callback.`,
    "2. Call mcp__thetower__post_message with exactly this private payload:",
    JSON.stringify({ content: markers.private, visibility: "private", visibleToAgentIds: ["observer"] }),
    "3. Call mcp__thetower__post_message with exactly this public payload:",
    JSON.stringify({ content: markers.public, visibility: "public" }),
    `4. After both tools succeed, return only ${markers.stream} as final stdout.`,
  ].join("\n");
}

function acceptanceModel(provider: "codex" | "claude"): string {
  const key = provider === "codex" ? "THE_TOWER_REAL_CODEX_MODEL" : "THE_TOWER_REAL_CLAUDE_MODEL";
  return process.env[key]?.trim() ?? "";
}

function acceptanceAgents(provider: "codex" | "claude", model: string): Agent[] {
  const now = Date.now();
  const persona = {
    roleDescription: "执行确定性的发布验收协议",
    personality: "精确、服从协议",
    strengths: ["调用指定工具"],
    restrictions: ["不得改写验收 marker", "不得跳过工具调用"],
  };
  return [
    { id: "source", displayName: `${provider} source`, mentionHandles: ["@source"], provider, model, persona, enabled: true, createdAt: now },
    { id: "observer", displayName: "Observer", mentionHandles: ["@observer"], provider: "mock", model: "mock-observer", persona, enabled: true, createdAt: now },
    { id: "outsider", displayName: "Outsider", mentionHandles: ["@outsider"], provider: "mock", model: "mock-outsider", persona, enabled: true, createdAt: now },
  ];
}

async function agentContext(baseUrl: string, threadId: string, agentId: string): Promise<Message[]> {
  const result = await jsonRequest<{ context: { messages: Message[] } }>(
    `${baseUrl}/api/threads/${threadId}/agent-context?agentId=${agentId}&limit=200`,
  );
  return result.context.messages;
}

async function waitForTerminal(context: ReturnType<typeof createAppContext>, invocationId: string, limitMs: number): Promise<string> {
  const startedAt = Date.now();
  for (;;) {
    const status = context.stores.invocationStore.get(invocationId)?.status;
    if (status === "done" || status === "failed" || status === "cancelled") return status;
    if (Date.now() - startedAt > limitMs) throw new Error(`Invocation ${invocationId} did not finish within ${limitMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function jsonRequest<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init.headers } });
  const body = await response.json() as T & { error?: string; code?: string };
  if (!response.ok) throw new Error(`${response.status} ${body.code ?? "request_failed"}: ${body.error ?? url}`);
  return body;
}

async function reservePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveReady, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveReady);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolveClosed, reject) => server.close((error) => (error ? reject(error) : resolveClosed())));
  if (!port) throw new Error("Could not reserve a loopback port");
  return port;
}

function hasOrigin(messages: Message[], origin: Message["origin"]): boolean {
  return messages.some((message) => message.origin === origin);
}

function hasOriginMarker(
  messages: Array<Pick<Message, "origin" | "content">>,
  origin: Message["origin"],
  marker: string,
): boolean {
  return messages.some((message) => message.origin === origin && message.content.includes(marker));
}

function toEvidence(message: Message): Record<string, unknown> {
  return {
    id: message.id,
    senderId: message.senderId,
    origin: message.origin,
    visibility: message.visibility,
    visibleToAgentIds: message.visibleToAgentIds,
    isExplicitPost: message.extra?.isExplicitPost,
    hasThinking: Boolean(message.thinking),
    content: message.content,
  };
}

function writeReport(provider: string, report: unknown): void {
  writeFileSync(join(reportDir, `${provider}-a2a-isolation.json`), `${JSON.stringify(report, null, 2)}\n`);
}

function captureEnv(keys: string[]): Map<string, string | undefined> {
  return new Map(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(values: Map<string, string | undefined>): void {
  for (const [key, value] of values) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
