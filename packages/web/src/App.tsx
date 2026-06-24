import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Circle, MessageSquare, Plus, RefreshCw, Save, Send, Server, Wifi, WifiOff } from "lucide-react";
import { TheTowerClient } from "@the-tower/sdk";
import type { Agent, AgentProvider, Message, Thread } from "@the-tower/shared";

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3001";
const providers: AgentProvider[] = ["mock", "codex", "claude", "gemini", "openai-api", "custom"];
let eventSequence = 0;

interface EventLogItem {
  id: number;
  receivedAt: number;
  event: unknown;
}

export function App() {
  const [apiBase, setApiBase] = useState(() => localStorage.getItem("the-tower-api-base") ?? DEFAULT_API_BASE);
  const [health, setHealth] = useState<"checking" | "ok" | "error">("checking");
  const [sseStatus, setSseStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("@agent-a 设计一个多 Agent 通信方案，然后请 @agent-b review");
  const [events, setEvents] = useState<EventLogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const client = useMemo(() => new TheTowerClient({ baseUrl: apiBase }), [apiBase]);

  const refreshAgents = useCallback(async () => {
    const result = await client.listAgents();
    setAgents(result.agents);
  }, [client]);

  const refreshThreads = useCallback(async () => {
    const result = await client.listThreads();
    setThreads(result.threads);
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

  const refreshAll = useCallback(async () => {
    setError(undefined);
    try {
      setHealth("checking");
      await client.health();
      setHealth("ok");
      await Promise.all([refreshAgents(), refreshThreads(), refreshMessages()]);
    } catch (err) {
      setHealth("error");
      setError((err as Error).message);
    }
  }, [client, refreshAgents, refreshMessages, refreshThreads]);

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
      const event = JSON.parse(message.data) as { type?: string; threadId?: string };
      setEvents((items) => [{ id: ++eventSequence, receivedAt: Date.now(), event }, ...items].slice(0, 40));
      void refreshThreads();
      if (event.threadId && event.threadId === selectedThreadId) void refreshMessages(event.threadId);
    };
    return () => source.close();
  }, [apiBase, refreshMessages, refreshThreads, selectedThreadId]);

  async function sendMessage() {
    const content = draft.trim();
    if (!content) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await client.postUserMessage({ threadId: selectedThreadId, content });
      setSelectedThreadId(result.threadId);
      setDraft("");
      await Promise.all([refreshThreads(), refreshMessages(result.threadId)]);
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
              <button
                className={`thread-row ${thread.id === selectedThreadId ? "selected" : ""}`}
                key={thread.id}
                type="button"
                onClick={() => {
                  setSelectedThreadId(thread.id);
                  void refreshMessages(thread.id);
                }}
              >
                <span>{thread.title}</span>
                <time>{new Date(thread.updatedAt).toLocaleTimeString()}</time>
              </button>
            ))}
          </div>
        </aside>

        <section className="thread-panel">
          <div className="panel-header">
            <SectionTitle icon={<MessageSquare size={15} />} title={selectedThreadId ?? "New thread"} />
            <button className="mini-button" type="button" onClick={() => void refreshMessages()}>
              <RefreshCw size={14} />
              Reload
            </button>
          </div>

          <div className="message-list">
            {messages.length === 0 ? (
              <div className="empty-state">No messages in this thread.</div>
            ) : (
              messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
          </div>

          <div className="composer">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="@agent-a 输入任务，或 @agent-b 指定 review"
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
          <SectionTitle icon={sseStatus === "connected" ? <Wifi size={15} /> : <WifiOff size={15} />} title="Events" />
          <div className="event-list">
            {events.length === 0 ? (
              <div className="empty-state compact">Waiting for SSE events.</div>
            ) : (
              events.map((item) => (
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

function MessageBubble({ message }: { message: Message }) {
  return (
    <article className={`message-bubble ${message.senderType}`}>
      <header>
        <strong>{message.senderId ?? message.senderType}</strong>
        <time>{new Date(message.createdAt).toLocaleTimeString()}</time>
      </header>
      <p>{message.content}</p>
      {message.mentions.length > 0 ? <footer>mentions: {message.mentions.join(", ")}</footer> : null}
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
