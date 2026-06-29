import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Circle,
  Eye,
  Filter,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Send,
  Server,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { TheTowerClient } from "@the-tower/sdk";
import { projectMessagesToBubbles } from "./messageProjection";
import type {
  Agent,
  AgentProvider,
  Invocation,
  Message,
  MessageOrigin,
  MessageVisibility,
  Thread,
  ThreadMode,
  Workspace,
} from "@the-tower/shared";

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3001";
const providers: AgentProvider[] = ["mock", "codex", "claude", "gemini", "openai-api", "custom"];
let eventSequence = 0;

interface EventLogItem {
  id: number;
  receivedAt: number;
  event: ServerEvent;
}

type ServerEvent =
  | { type: "message.created"; threadId: string; messageId: string }
  | { type: "message.updated"; threadId: string; messageId: string }
  | { type: "invocation.updated"; threadId: string; invocationId: string; status: string }
  | {
      type: "workspace.resolved";
      threadId: string;
      invocationId: string;
      projectPath?: string;
      workingDirectory?: string;
      workspaceFingerprint?: string;
    }
  | {
      type: "workspace.file_tool";
      threadId: string;
      invocationId: string;
      agentId: string;
      tool: "read_file" | "read_file_slice" | "list_files" | "write_file";
      path: string;
      bytes?: number;
      denied: boolean;
      reason?: string;
      createdAt: number;
    }
  | { type: "worklist.updated"; threadId: string; invocationId: string; agents: string[] }
  | {
      type: "agent.event";
      threadId: string;
      invocationId: string;
      agentId: string;
      eventType: "text" | "tool_call" | "error" | "done";
      name?: string;
      error?: string;
    }
  | {
      type: "callback.write";
      threadId: string;
      invocationId: string;
      agentId: string;
      messageId: string;
      visibility: "public" | "private";
      routed: string[];
    };

type MessageAuditFilter = "all" | "private" | "callback" | "privateCallback" | "revealed" | "handoff";

const messageAuditFilters: Array<{ id: MessageAuditFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "private", label: "Private" },
  { id: "callback", label: "Callback" },
  { id: "privateCallback", label: "Private callback" },
  { id: "revealed", label: "Revealed" },
  { id: "handoff", label: "Handoff" },
];

export function App() {
  const [apiBase, setApiBase] = useState(() => localStorage.getItem("the-tower-api-base") ?? DEFAULT_API_BASE);
  const [health, setHealth] = useState<"checking" | "ok" | "error">("checking");
  const [sseStatus, setSseStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [invocations, setInvocations] = useState<Invocation[]>([]);
  const [draft, setDraft] = useState("");
  const [draftProjectPath, setDraftProjectPath] = useState(() => localStorage.getItem("the-tower-project-path") ?? "");
  const [threadProjectPathDraft, setThreadProjectPathDraft] = useState("");
  const [events, setEvents] = useState<EventLogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [auditFilter, setAuditFilter] = useState<MessageAuditFilter>("all");

  const client = useMemo(() => new TheTowerClient({ baseUrl: apiBase }), [apiBase]);
  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId),
    [selectedThreadId, threads],
  );
  const messageAuditCounts = useMemo(() => buildMessageAuditCounts(messages), [messages]);
  const messageBubbles = useMemo(() => projectMessagesToBubbles(messages), [messages]);
  const visibleMessages = useMemo(
    () => messageBubbles.filter((message) => matchesMessageAuditFilter(message, auditFilter)),
    [auditFilter, messageBubbles],
  );
  const selectedThreadEvents = useMemo(
    () => events.filter((item) => !selectedThreadId || item.event.threadId === selectedThreadId),
    [events, selectedThreadId],
  );

  const refreshAgents = useCallback(async () => {
    const result = await client.listAgents();
    setAgents(result.agents);
  }, [client]);

  const refreshThreads = useCallback(async () => {
    const result = await client.listThreads();
    setThreads(result.threads);
  }, [client]);

  const deleteThread = useCallback(
    async (threadId: string) => {
      if (!window.confirm("Delete this thread and all its messages?")) return;
      await client.deleteThread(threadId);
      if (threadId === selectedThreadId) setSelectedThreadId(undefined);
      await refreshThreads();
    },
    [client, selectedThreadId, refreshThreads],
  );

  const refreshWorkspaces = useCallback(async () => {
    const result = await client.listWorkspaces();
    setWorkspaces(result.workspaces);
  }, [client]);

  const refreshMessages = useCallback(
    async (threadId = selectedThreadId) => {
      if (!threadId) {
        setMessages([]);
        return;
      }
      const result = await client.getThreadMessages(threadId, 200);
      setMessages(result.messages);
    },
    [client, selectedThreadId],
  );

  const refreshInvocations = useCallback(
    async (threadId = selectedThreadId) => {
      if (!threadId) {
        setInvocations([]);
        return;
      }
      const result = await client.getThreadInvocations(threadId, 50);
      setInvocations(result.invocations);
    },
    [client, selectedThreadId],
  );

  const refreshAll = useCallback(async () => {
    setError(undefined);
    try {
      setHealth("checking");
      await client.health();
      setHealth("ok");
      await Promise.all([refreshAgents(), refreshThreads(), refreshWorkspaces(), refreshMessages(), refreshInvocations()]);
    } catch (err) {
      setHealth("error");
      setError((err as Error).message);
    }
  }, [client, refreshAgents, refreshInvocations, refreshMessages, refreshThreads, refreshWorkspaces]);

  useEffect(() => {
    setThreadProjectPathDraft(selectedThread?.projectPath ?? "");
  }, [selectedThread]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    localStorage.setItem("the-tower-api-base", apiBase);
  }, [apiBase]);

  useEffect(() => {
    setSseStatus("connecting");
    const source = new EventSource(`${apiBase.replace(/\/+$/, "")}/api/events`);
    source.onopen = () => setSseStatus("connected");
    source.onerror = () => setSseStatus("error");
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as ServerEvent;
      setEvents((items) => [{ id: ++eventSequence, receivedAt: Date.now(), event }, ...items].slice(0, 40));
      void refreshThreads();
      if (event.threadId && event.threadId === selectedThreadId) {
        void refreshMessages(event.threadId);
        void refreshInvocations(event.threadId);
      }
    };
    return () => source.close();
  }, [apiBase, refreshInvocations, refreshMessages, refreshThreads, selectedThreadId]);

  async function sendMessage() {
    const content = draft.trim();
    if (!content) return;
    setBusy(true);
    setError(undefined);
    try {
      const projectPath = selectedThreadId ? undefined : draftProjectPath.trim() || undefined;
      const result = await client.postUserMessage({ threadId: selectedThreadId, content, projectPath });
      setSelectedThreadId(result.threadId);
      setDraft("");
      if (projectPath) localStorage.setItem("the-tower-project-path", projectPath);
      await Promise.all([refreshThreads(), refreshMessages(result.threadId), refreshInvocations(result.threadId)]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function updateAgent(agentId: string, patch: Partial<Agent>) {
    setError(undefined);
    const result = await client.updateAgent(agentId, patch);
    setAgents((items) => items.map((agent) => (agent.id === agentId ? result.agent : agent)));
  }

  async function updateThreadMode(mode: ThreadMode) {
    if (!selectedThreadId) return;
    setError(undefined);
    try {
      const result = await client.updateThread(selectedThreadId, { mode });
      setThreads((items) => items.map((thread) => (thread.id === selectedThreadId ? result.thread : thread)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function updateThreadProjectPath() {
    if (!selectedThreadId) return;
    setError(undefined);
    try {
      const result = await client.updateThread(selectedThreadId, {
        projectPath: threadProjectPathDraft.trim() || null,
      });
      setThreads((items) => items.map((thread) => (thread.id === selectedThreadId ? result.thread : thread)));
      await refreshWorkspaces();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function revealMessage(messageId: string) {
    if (!selectedThreadId) return;
    setError(undefined);
    try {
      const result = await client.revealMessage(selectedThreadId, messageId);
      setMessages((items) => items.map((message) => (message.id === messageId ? result.message : message)));
      await refreshThreads();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>TheTower Debug Console</h1>
          <p>Multi-agent communication kernel</p>
        </div>
        <label className="api-control">
          <Server size={16} />
          <input value={apiBase} onChange={(event) => setApiBase(event.target.value)} />
        </label>
        <button className="icon-button" type="button" onClick={() => void refreshAll()} title="刷新">
          <RefreshCw size={17} />
        </button>
        <StatusPill health={health} sse={sseStatus} />
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="workspace">
        <aside className="agents-panel">
          <SectionTitle icon={<Circle size={15} />} title="Agents" />
          <div className="agent-list">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onSave={(patch) => updateAgent(agent.id, patch)} />
            ))}
          </div>
        </aside>

        <aside className="threads-panel">
          <div className="panel-header">
            <SectionTitle icon={<MessageSquare size={15} />} title="Threads" />
            <button className="mini-button" type="button" onClick={() => setSelectedThreadId(undefined)}>
              <Plus size={14} />
              New
            </button>
          </div>
          <div className="thread-list">
            {threads.map((thread) => (
              <div
                className={`thread-row ${thread.id === selectedThreadId ? "selected" : ""}`}
                key={thread.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedThreadId(thread.id);
                  void refreshMessages(thread.id);
                  void refreshInvocations(thread.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedThreadId(thread.id);
                    void refreshMessages(thread.id);
                    void refreshInvocations(thread.id);
                  }
                }}
              >
                <span>{thread.title}</span>
                <div className="thread-row-meta">
                  <time>{workspaceLabel(thread.projectPath)}</time>
                  <div className="thread-row-tail">
                    <span className={`mode-badge ${thread.mode ?? "debug"}`}>{thread.mode ?? "debug"}</span>
                    <button
                      className="thread-delete"
                      type="button"
                      title="Delete thread"
                      aria-label={`Delete thread ${thread.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteThread(thread.id);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="thread-panel">
          <div className="panel-header">
            <SectionTitle icon={<MessageSquare size={15} />} title={selectedThreadId ?? "New thread"} />
            <div className="thread-actions">
              {selectedThread ? (
                <>
                  <label className="mode-control">
                    Mode
                    <select
                      value={selectedThread.mode ?? "debug"}
                      onChange={(event) => void updateThreadMode(event.target.value as ThreadMode)}
                    >
                      <option value="debug">debug</option>
                      <option value="play">play</option>
                    </select>
                  </label>
                  <div className="workspace-control">
                    <label>
                      Working directory
                      <input
                        value={threadProjectPathDraft}
                        onChange={(event) => setThreadProjectPathDraft(event.target.value)}
                        placeholder="/Users/xuchenyang/ai/TheTower"
                      />
                    </label>
                    <button className="mini-button" type="button" onClick={() => void updateThreadProjectPath()}>
                      <Save size={13} />
                      Save
                    </button>
                  </div>
                </>
              ) : null}
              <button
                className="mini-button"
                type="button"
                onClick={() => void Promise.all([refreshMessages(), refreshInvocations()])}
              >
                <RefreshCw size={14} />
                Reload
              </button>
            </div>
          </div>

          <div className="audit-toolbar">
            <div className="audit-toolbar-title">
              <Filter size={14} />
              <span>Audit</span>
            </div>
            <div className="audit-filter-list">
              {messageAuditFilters.map((filter) => (
                <button
                  className={`audit-filter ${auditFilter === filter.id ? "selected" : ""}`}
                  key={filter.id}
                  type="button"
                  onClick={() => setAuditFilter(filter.id)}
                >
                  <span>{filter.label}</span>
                  <strong>{messageAuditCounts[filter.id]}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="message-list">
            {!selectedThread ? (
              <div className="new-thread-workspace">
                <label>
                  Working directory
                  <input
                    value={draftProjectPath}
                    onChange={(event) => setDraftProjectPath(event.target.value)}
                    list="workspace-paths"
                    placeholder="/Users/xuchenyang/ai/TheTower"
                  />
                </label>
                <datalist id="workspace-paths">
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.projectPath}>
                      {workspace.name}
                    </option>
                  ))}
                </datalist>
              </div>
            ) : null}
            {messages.length === 0 ? (
              <div className="empty-state">No messages in this thread.</div>
            ) : visibleMessages.length === 0 ? (
              <div className="empty-state">No messages match this audit filter.</div>
            ) : (
              visibleMessages.map((message) => (
                <MessageBubble key={message.id} message={message} onReveal={() => void revealMessage(message.id)} />
              ))
            )}
          </div>

          <div className="composer">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder=""
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void sendMessage();
              }}
            />
            <button className="send-button" type="button" disabled={busy || !draft.trim()} onClick={() => void sendMessage()}>
              <Send size={16} />
              Send
            </button>
          </div>
        </section>

        <aside className="events-panel">
          <SectionTitle icon={sseStatus === "connected" ? <Wifi size={15} /> : <WifiOff size={15} />} title="Invocations" />
          <InvocationPanel invocations={invocations} events={selectedThreadEvents} />
          <SectionTitle icon={sseStatus === "connected" ? <Wifi size={15} /> : <WifiOff size={15} />} title="Events" />
          <div className="event-list">
            {selectedThreadEvents.length === 0 ? (
              <div className="empty-state compact">Waiting for SSE events.</div>
            ) : (
              selectedThreadEvents.map((item) => (
                <pre key={item.id} className="event-row">
                  <span>{new Date(item.receivedAt).toLocaleTimeString()}</span>
                  {JSON.stringify(item.event, null, 2)}
                </pre>
              ))
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function InvocationPanel({ invocations, events }: { invocations: Invocation[]; events: EventLogItem[] }) {
  if (invocations.length === 0) return <div className="empty-state compact">No invocations for this thread.</div>;
  return (
    <div className="invocation-list">
      {invocations.map((invocation) => {
        const relatedEvents = events
          .filter((item) => "invocationId" in item.event && item.event.invocationId === invocation.id)
          .slice(0, 8);
        return (
          <article className="invocation-card" key={invocation.id}>
            <header>
              <strong>{shortId(invocation.id)}</strong>
              <span className={`invocation-status ${invocation.status}`}>{invocation.status}</span>
            </header>
            <dl>
              <dt>mode</dt>
              <dd>{invocation.routeMode ?? (invocation.targetAgents.length > 1 ? "fanout" : "single")}</dd>
              <dt>targets</dt>
              <dd>{invocation.targetAgents.join(", ") || "(none)"}</dd>
              <dt>started</dt>
              <dd>{new Date(invocation.createdAt).toLocaleTimeString()}</dd>
            </dl>
            <div className="invocation-events">
              {relatedEvents.length === 0 ? (
                <span className="event-empty">No live events.</span>
              ) : (
                relatedEvents.map((item) => (
                  <div className="invocation-event" key={item.id}>
                    <time>{new Date(item.receivedAt).toLocaleTimeString()}</time>
                    <span>{formatEventLabel(item.event)}</span>
                  </div>
                ))
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function AgentCard({ agent, onSave }: { agent: Agent; onSave: (patch: Partial<Agent>) => Promise<void> }) {
  const [provider, setProvider] = useState<AgentProvider>(agent.provider);
  const [model, setModel] = useState(agent.model);
  const [enabled, setEnabled] = useState(agent.enabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProvider(agent.provider);
    setModel(agent.model);
    setEnabled(agent.enabled);
  }, [agent]);

  async function save() {
    setSaving(true);
    try {
      await onSave({ provider, model, enabled });
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="agent-card">
      <div className="agent-title">
        <div>
          <h2>{agent.displayName}</h2>
          <p>{agent.mentionHandles.join(" ")}</p>
        </div>
        <span className={`agent-status ${enabled ? "on" : "off"}`}>{enabled ? "on" : "off"}</span>
      </div>

      <label>
        Provider
        <select value={provider} onChange={(event) => setProvider(event.target.value as AgentProvider)}>
          {providers.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <label>
        Model
        <input value={model} onChange={(event) => setModel(event.target.value)} />
      </label>

      <label className="check-row">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Enabled
      </label>

      <button className="save-button" type="button" disabled={saving} onClick={() => void save()}>
        {saving ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
        Save
      </button>
    </article>
  );
}

function MessageBubble({ message, onReveal }: { message: Message; onReveal: () => void }) {
  const visibility = message.visibility ?? "public";
  const deliveryStatus = message.deliveryStatus ?? "delivered";
  const origin = message.origin ?? "agent_final";
  const canReveal = visibility === "private" && !message.revealedAt;
  const isAgentStream = origin === "agent_stream";
  return (
    <article className={`message-bubble ${message.senderType} ${visibility}`}>
      <header>
        <div className="message-title">
          <strong>{message.senderId ?? message.senderType}</strong>
          <span className={`visibility-badge ${visibility}`}>
            {visibility === "private" ? <Lock size={12} /> : <Eye size={12} />}
            {visibility}
          </span>
          {message.revealedAt ? <span className="reveal-state">revealed</span> : null}
        </div>
        <div className="message-actions">
          {canReveal ? (
            <button className="mini-icon-button" type="button" onClick={onReveal} title="Reveal private message">
              <Eye size={13} />
            </button>
          ) : null}
          <time>{new Date(message.createdAt).toLocaleTimeString()}</time>
        </div>
      </header>
      {isAgentStream ? (
        <details className="cli-output-details">
          <summary>CLI output</summary>
          <pre>{message.content}</pre>
        </details>
      ) : (
        <p>{message.content}</p>
      )}
      <footer>
        <span>origin: {origin}</span>
        <span>status: {deliveryStatus}</span>
        {message.mentions.length > 0 ? <span>mentions: {message.mentions.join(", ")}</span> : null}
        {message.visibleToAgentIds && message.visibleToAgentIds.length > 0 ? (
          <span>visibleTo: {message.visibleToAgentIds.join(", ")}</span>
        ) : null}
        {message.revealedAt ? <span>revealed: {new Date(message.revealedAt).toLocaleTimeString()}</span> : null}
      </footer>
      {message.handoffPayload ? (
        <details className="handoff-details">
          <summary>handoff payload</summary>
          <dl>
            <dt>from</dt>
            <dd>{message.handoffPayload.fromAgentId}</dd>
            <dt>to</dt>
            <dd>{message.handoffPayload.toAgentIds.join(", ")}</dd>
            <dt>what</dt>
            <dd>{message.handoffPayload.what}</dd>
            <dt>why</dt>
            <dd>{message.handoffPayload.why}</dd>
            <dt>tradeoff</dt>
            <dd>{message.handoffPayload.tradeoff}</dd>
            <dt>next</dt>
            <dd>{message.handoffPayload.nextAction}</dd>
            {message.handoffPayload.openQuestions.length > 0 ? (
              <>
                <dt>questions</dt>
                <dd>{message.handoffPayload.openQuestions.join(" | ")}</dd>
              </>
            ) : null}
          </dl>
        </details>
      ) : null}
    </article>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="section-title">
      {icon}
      <span>{title}</span>
    </div>
  );
}

function StatusPill({ health, sse }: { health: string; sse: string }) {
  const ok = health === "ok" && sse === "connected";
  return (
    <div className={`status-pill ${ok ? "ok" : "warn"}`}>
      {ok ? <Check size={15} /> : <Circle size={15} />}
      API {health} · SSE {sse}
    </div>
  );
}

function buildMessageAuditCounts(messages: Message[]): Record<MessageAuditFilter, number> {
  return {
    all: messages.length,
    private: messages.filter((message) => getMessageVisibility(message) === "private").length,
    callback: messages.filter((message) => getMessageOrigin(message) === "callback").length,
    privateCallback: messages.filter(
      (message) => getMessageVisibility(message) === "private" && getMessageOrigin(message) === "callback",
    ).length,
    revealed: messages.filter((message) => Boolean(message.revealedAt)).length,
    handoff: messages.filter((message) => Boolean(message.handoffPayload)).length,
  };
}

function matchesMessageAuditFilter(message: Message, filter: MessageAuditFilter): boolean {
  if (filter === "all") return true;
  if (filter === "private") return getMessageVisibility(message) === "private";
  if (filter === "callback") return getMessageOrigin(message) === "callback";
  if (filter === "privateCallback") {
    return getMessageVisibility(message) === "private" && getMessageOrigin(message) === "callback";
  }
  if (filter === "revealed") return Boolean(message.revealedAt);
  return Boolean(message.handoffPayload);
}

function getMessageVisibility(message: Message): MessageVisibility {
  return message.visibility ?? "public";
}

function getMessageOrigin(message: Message): MessageOrigin {
  return message.origin ?? "agent_final";
}

function shortId(id: string | undefined): string {
  if (!id) return "unknown";
  return id.length > 8 ? id.slice(0, 8) : id;
}

function workspaceLabel(projectPath: string | undefined): string {
  if (!projectPath) return "No workspace";
  const parts = projectPath.split("/").filter(Boolean);
  return parts.at(-1) ?? projectPath;
}

function formatEventLabel(event: ServerEvent): string {
  if (event.type === "invocation.updated") return `invocation ${event.status}`;
  if (event.type === "workspace.resolved") return `workspace ${workspaceLabel(event.workingDirectory ?? event.projectPath)}`;
  if (event.type === "workspace.file_tool") {
    const status = event.denied ? `denied${event.reason ? `: ${event.reason}` : ""}` : "ok";
    const bytes = event.bytes === undefined ? "" : ` ${event.bytes}b`;
    return `${event.agentId} ${event.tool}${bytes} ${status}`;
  }
  if (event.type === "worklist.updated") return `worklist ${event.agents.join(" -> ")}`;
  if (event.type === "agent.event") {
    if (event.eventType === "tool_call") return `${event.agentId} tool ${event.name ?? ""}`.trim();
    if (event.eventType === "error") return `${event.agentId} error ${event.error ?? ""}`.trim();
    return `${event.agentId} ${event.eventType}`;
  }
  if (event.type === "callback.write") {
    const routed = event.routed.length > 0 ? ` -> ${event.routed.join(", ")}` : "";
    return `${event.agentId} callback ${event.visibility}${routed}`;
  }
  if (event.type === "message.created") return `message ${shortId(event.messageId)} created`;
  if (event.type === "message.updated") return `message ${shortId(event.messageId)} updated`;
  return "event";
}
