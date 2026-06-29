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
  AgentPersona,
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

// 以下常量集中表达带变体的元素样式，避免 JSX 中出现超长三元字符串。
const panelBase = "min-h-0 border border-[#d8e0e2] rounded-lg bg-white flex flex-col overflow-hidden";
const sectionTitle = "h-11 flex items-center gap-2 px-3 border-b border-[#e1e6e8] text-[#39484c] text-[13px] font-bold uppercase";
const panelHeader = "flex items-center justify-between border-b border-[#e1e6e8] pr-[10px]";

const btnBase = "inline-flex items-center justify-center gap-[7px] border border-[#c8d1d4] bg-white text-[#172124] rounded-md";
const iconButton = `${btnBase} w-9 h-9`;
const miniButton = `${btnBase} h-[30px] px-[10px] text-[13px]`;
const saveButton = `${btnBase} h-[34px] disabled:opacity-60 disabled:cursor-not-allowed`;
const sendButton =
  "inline-flex items-center justify-center gap-[7px] h-[86px] rounded-md border border-[#173f46] bg-[#173f46] text-white disabled:opacity-60 disabled:cursor-not-allowed";

const statusPill = {
  base: "h-8 inline-flex items-center gap-[7px] px-[10px] rounded-full text-[13px] whitespace-nowrap",
  ok: "bg-[#e8f5ef] text-[#176348]",
  warn: "bg-[#fff3dd] text-[#805518]",
};

const agentStatus = {
  base: "rounded-full px-[7px] py-[2px] text-[12px]",
  on: "text-[#155e45] bg-[#def3eb]",
  off: "text-[#75606b] bg-[#eee7eb]",
};

const badgeBase =
  "min-h-[20px] inline-flex items-center justify-center gap-[4px] rounded-full px-[7px] py-[1px] text-[12px] leading-none whitespace-nowrap";
const modeBadge: Record<ThreadMode, string> = {
  debug: "bg-[#edf2f7] text-[#34454b]",
  play: "bg-[#e8f5ef] text-[#176348]",
};
const visibilityBadge: Record<string, string> = {
  public: "bg-[#e9f3f6] text-[#225363]",
  private: "bg-[#faedcf] text-[#77541a]",
};

const invocationStatusBase = "min-h-[20px] inline-flex items-center rounded-full px-[7px] py-[1px] text-[12px]";
const invocationStatus: Record<string, string> = {
  queued: "bg-[#edf2f7] text-[#34454b]",
  running: "bg-[#e9f3f6] text-[#225363]",
  done: "bg-[#e8f5ef] text-[#176348]",
  failed: "bg-[#fff3f2] text-[#9b2c2c]",
  cancelled: "bg-[#fff3f2] text-[#9b2c2c]",
};

const auditFilterBase =
  "min-h-[30px] inline-flex items-center gap-[6px] border border-[#cbd5d8] rounded-md px-[9px] bg-white text-[#263236] text-[12px] whitespace-nowrap";
const auditFilterSelected = "border-[#7fb1bd] bg-[#eaf5f7] text-[#173f46]";
const auditFilterCount =
  "min-w-[18px] min-h-[18px] inline-flex items-center justify-center rounded-full bg-[#edf2f4] text-[#425158] text-[11px]";
const auditFilterCountSelected = "bg-[#173f46] text-white";

const threadRowBase =
  "group w-full min-h-[52px] border border-transparent rounded-[7px] bg-transparent p-2 text-left grid gap-[3px] hover:border-[#bdd4d8] hover:bg-[#eef7f8]";
const threadDelete =
  "inline-flex items-center justify-center w-[22px] h-[22px] p-0 border border-transparent rounded-[5px] bg-transparent text-[#778487] cursor-pointer opacity-0 transition duration-[120ms] ease-in-out group-hover:opacity-100 group-focus-within:opacity-100 hover:text-[#b4232a] hover:border-[#e9a8a8] hover:bg-[#fbeaec]";

const emptyState =
  "m-auto text-[#788588] border border-dashed border-[#cdd7da] rounded-lg p-[18px] text-center";
const emptyStateCompact =
  "m-0 text-[#788588] border border-dashed border-[#cdd7da] rounded-lg p-3 text-center";

const inputBase = "min-w-0 h-[34px] border border-[#cfd8db] rounded-md px-2 bg-white text-[#162022]";

// 消息气泡的最终样式按 senderType + visibility 解析单值，复刻原 CSS 级联（private 覆盖 bg 且改 border-style，但不改 border-color/align/max-width）。
function messageBubbleClass(senderType: string, visibility: string): string {
  const senderStyles: Record<string, { align: string; border: string; bg: string; max?: string }> = {
    user: { align: "self-end", border: "border-[#b9d3db]", bg: "bg-[#eef8fb]" },
    agent: { align: "self-start", border: "border-[#cddbc9]", bg: "bg-[#f3faf0]" },
    system: { align: "self-center", border: "border-[#ded0e6]", bg: "bg-[#f5f0f7]", max: "max-w-[96%]" },
  };
  const s = senderStyles[senderType] ?? senderStyles.agent;
  const isPrivate = visibility === "private";
  return [
    "border rounded-lg px-[11px] py-[10px]",
    isPrivate ? "border-dashed" : "",
    s.align,
    s.border,
    isPrivate ? "bg-[#fffaf0]" : s.bg,
    s.max ?? "max-w-[86%]",
  ]
    .filter(Boolean)
    .join(" ");
}

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
    <main className="h-[100dvh] min-h-0 flex flex-col overflow-hidden">
      <header className="h-[72px] shrink-0 grid grid-cols-[minmax(220px,1fr)_minmax(320px,520px)_36px_auto] items-center gap-3 px-[18px] border-b border-[#d9e0e2] bg-white">
        <div>
          <h1 className="m-0 text-[18px] leading-[1.2]">TheTower Debug Console</h1>
          <p className="mt-[3px] text-[#697679] text-[13px]">Multi-agent communication kernel</p>
        </div>
        <label className="h-[38px] flex items-center gap-2 px-[10px] border border-[#cfd8db] rounded-md bg-[#f9fbfb] text-[#637174]">
          <Server size={16} />
          <input className="w-full border-0 outline-0 bg-transparent text-[#162022]" value={apiBase} onChange={(event) => setApiBase(event.target.value)} />
        </label>
        <button className={iconButton} type="button" onClick={() => void refreshAll()} title="刷新">
          <RefreshCw size={17} />
        </button>
        <StatusPill health={health} sse={sseStatus} />
      </header>

      {error ? (
        <div className="shrink-0 mx-[18px] mt-3 p-[10px] border border-[#edc7c7] rounded-md bg-[#fff3f2] text-[#9b2c2c]">
          {error}
        </div>
      ) : null}

      <section className="flex-1 grid grid-cols-[280px_250px_minmax(460px,1fr)_320px] gap-3 p-3 min-h-0 overflow-hidden max-[1280px]:grid-cols-[250px_220px_minmax(420px,1fr)]">
        <aside className={panelBase}>
          <SectionTitle icon={<Circle size={15} />} title="Agents" />
          <div className="min-h-0 overflow-auto p-[10px] grid gap-[10px]">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onSave={(patch) => updateAgent(agent.id, patch)} />
            ))}
          </div>
        </aside>

        <aside className={panelBase}>
          <div className={panelHeader}>
            <SectionTitle icon={<MessageSquare size={15} />} title="Threads" flush />
            <button className={miniButton} type="button" onClick={() => setSelectedThreadId(undefined)}>
              <Plus size={14} />
              New
            </button>
          </div>
          <div className="min-h-0 overflow-auto p-2 grid content-start gap-[6px]">
            {threads.map((thread) => {
              const selected = thread.id === selectedThreadId;
              return (
                <div
                  className={`${threadRowBase}${selected ? " border-[#bdd4d8] bg-[#eef7f8]" : ""}`}
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
                  <span className="truncate text-[13px] text-[#172124]">{thread.title}</span>
                  <div className="flex items-center justify-between gap-2">
                    <time className="text-[#778487] text-[12px]">{workspaceLabel(thread.projectPath)}</time>
                    <div className="inline-flex items-center gap-[6px]">
                      <span className={`${badgeBase} ${modeBadge[thread.mode ?? "debug"]}`}>{thread.mode ?? "debug"}</span>
                      <button
                        className={`${threadDelete}${selected ? " opacity-100" : ""}`}
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
              );
            })}
          </div>
        </aside>

        <section className="min-h-0 border border-[#d8e0e2] rounded-lg bg-white overflow-hidden grid grid-rows-[auto_auto_minmax(0,1fr)_auto]">
          <div className={panelHeader}>
            <SectionTitle icon={<MessageSquare size={15} />} title={selectedThreadId ?? "New thread"} flush />
            <div className="flex flex-wrap items-center justify-end gap-2">
              {selectedThread ? (
                <>
                  <label className="h-[30px] inline-flex items-center gap-[6px] text-[#5d696d] text-[12px]">
                    Mode
                    <select
                      className="h-[30px] border border-[#c8d1d4] rounded-md bg-white text-[#172124] px-[7px]"
                      value={selectedThread.mode ?? "debug"}
                      onChange={(event) => void updateThreadMode(event.target.value as ThreadMode)}
                    >
                      <option value="debug">debug</option>
                      <option value="play">play</option>
                    </select>
                  </label>
                  <label className="h-[30px] inline-flex items-center gap-[6px] text-[#5d696d] text-[12px]">
                    Working directory
                    <input
                      className="w-[200px] h-[30px] border border-[#c8d1d4] rounded-md px-2 bg-white text-[#172124]"
                      value={threadProjectPathDraft}
                      onChange={(event) => setThreadProjectPathDraft(event.target.value)}
                      placeholder="/Users/xuchenyang/ai/TheTower"
                    />
                  </label>
                  <button className={miniButton} type="button" onClick={() => void updateThreadProjectPath()}>
                    <Save size={13} />
                    Save
                  </button>
                </>
              ) : null}
              <button
                className={miniButton}
                type="button"
                onClick={() => void Promise.all([refreshMessages(), refreshInvocations()])}
              >
                <RefreshCw size={14} />
                Reload
              </button>
            </div>
          </div>

          <div className="min-h-[46px] grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[10px] px-[10px] py-2 border-b border-[#e1e6e8] bg-[#fbfcfc]">
            <div className="inline-flex items-center gap-[6px] text-[#566367] text-[12px] font-bold uppercase">
              <Filter size={14} />
              <span>Audit</span>
            </div>
            <div className="min-w-0 flex items-center gap-[6px] overflow-x-auto">
              {messageAuditFilters.map((filter) => {
                const selected = auditFilter === filter.id;
                return (
                  <button
                    className={`${auditFilterBase}${selected ? ` ${auditFilterSelected}` : ""}`}
                    key={filter.id}
                    type="button"
                    onClick={() => setAuditFilter(filter.id)}
                  >
                    <span>{filter.label}</span>
                    <strong className={`${auditFilterCount}${selected ? ` ${auditFilterCountSelected}` : ""}`}>
                      {messageAuditCounts[filter.id]}
                    </strong>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 overflow-auto p-[14px] flex flex-col gap-[10px]">
            {!selectedThread ? (
              <div className="m-3 p-[10px] border border-[#d8e0e2] rounded-lg bg-[#fbfcfc]">
                <label className="grid gap-[4px] text-[#5d696d] text-[12px]">
                  Working directory
                  <input
                    className="min-w-0 h-[30px] border border-[#c8d1d4] rounded-md px-2 bg-white text-[#172124]"
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
              <div className={emptyState}>No messages in this thread.</div>
            ) : visibleMessages.length === 0 ? (
              <div className={emptyState}>No messages match this audit filter.</div>
            ) : (
              visibleMessages.map((message) => (
                <MessageBubble key={message.id} message={message} onReveal={() => void revealMessage(message.id)} />
              ))
            )}
          </div>

          <div className="border-t border-[#e1e6e8] p-[10px] grid grid-cols-[minmax(0,1fr)_94px] gap-[10px]">
            <textarea
              className="h-[86px] resize-none border border-[#cfd8db] rounded-[7px] p-[10px] outline-none focus:border-[#7fb1bd] focus:shadow-[0_0_0_3px_rgba(127,177,189,0.18)]"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder=""
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void sendMessage();
              }}
            />
            <button className={sendButton} type="button" disabled={busy || !draft.trim()} onClick={() => void sendMessage()}>
              <Send size={16} />
              Send
            </button>
          </div>
        </section>

        <aside className={`${panelBase} max-[1280px]:hidden`}>
          <SectionTitle icon={sseStatus === "connected" ? <Wifi size={15} /> : <WifiOff size={15} />} title="Invocations" />
          <InvocationPanel invocations={invocations} events={selectedThreadEvents} />
          <SectionTitle icon={sseStatus === "connected" ? <Wifi size={15} /> : <WifiOff size={15} />} title="Events" />
          <div className="min-h-0 overflow-auto p-2 grid content-start gap-2">
            {selectedThreadEvents.length === 0 ? (
              <div className={emptyStateCompact}>Waiting for SSE events.</div>
            ) : (
              selectedThreadEvents.map((item) => (
                <pre
                  key={item.id}
                  className="m-0 border border-[#d8e0e2] rounded-[7px] bg-[#fbfcfc] p-2 text-[#2d3a3e] text-[12px] whitespace-pre-wrap [overflow-wrap:anywhere]"
                >
                  <span className="block mb-1 text-[#778487]">{new Date(item.receivedAt).toLocaleTimeString()}</span>
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
  if (invocations.length === 0) return <div className={emptyStateCompact}>No invocations for this thread.</div>;
  return (
    <div className="max-h-[42%] min-h-[150px] overflow-auto p-2 grid content-start gap-2 border-b border-[#e1e6e8]">
      {invocations.map((invocation) => {
        const relatedEvents = events
          .filter((item) => "invocationId" in item.event && item.event.invocationId === invocation.id)
          .slice(0, 8);
        return (
          <article className="border border-[#d8e0e2] rounded-lg bg-[#fbfcfc] p-2 grid gap-[7px]" key={invocation.id}>
            <header className="flex items-center justify-between gap-2">
              <strong className="text-[#1c2b2f] text-[13px]">{shortId(invocation.id)}</strong>
              <span className={`${invocationStatusBase} ${invocationStatus[invocation.status] ?? ""}`}>
                {invocation.status}
              </span>
            </header>
            <dl className="m-0 grid grid-cols-[58px_minmax(0,1fr)] gap-x-2 gap-y-[4px] text-[12px]">
              <dt className="text-[#718083]">mode</dt>
              <dd className="m-0 text-[#2d3a3e] [overflow-wrap:anywhere]">
                {invocation.routeMode ?? (invocation.targetAgents.length > 1 ? "fanout" : "single")}
              </dd>
              <dt className="text-[#718083]">targets</dt>
              <dd className="m-0 text-[#2d3a3e] [overflow-wrap:anywhere]">{invocation.targetAgents.join(", ") || "(none)"}</dd>
              <dt className="text-[#718083]">started</dt>
              <dd className="m-0 text-[#2d3a3e] [overflow-wrap:anywhere]">{new Date(invocation.createdAt).toLocaleTimeString()}</dd>
            </dl>
            <div className="grid gap-[4px]">
              {relatedEvents.length === 0 ? (
                <span className="text-[#778487] text-[12px]">No live events.</span>
              ) : (
                relatedEvents.map((item) => (
                  <div
                    className="min-w-0 grid grid-cols-[68px_minmax(0,1fr)] gap-[6px] text-[#334247] text-[12px]"
                    key={item.id}
                  >
                    <time className="text-[#778487]">{new Date(item.receivedAt).toLocaleTimeString()}</time>
                    <span className="[overflow-wrap:anywhere]">{formatEventLabel(item.event)}</span>
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
  const [persona, setPersona] = useState<AgentPersona>(agent.persona);
  const [strengthsText, setStrengthsText] = useState(agent.persona.strengths.join(", "));
  const [restrictionsText, setRestrictionsText] = useState(agent.persona.restrictions.join(", "));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProvider(agent.provider);
    setModel(agent.model);
    setEnabled(agent.enabled);
    setPersona(agent.persona);
    setStrengthsText(agent.persona.strengths.join(", "));
    setRestrictionsText(agent.persona.restrictions.join(", "));
  }, [agent]);

  async function save() {
    setSaving(true);
    try {
      await onSave({
        provider,
        model,
        enabled,
        persona: {
          ...persona,
          strengths: splitList(strengthsText),
          restrictions: splitList(restrictionsText),
        },
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="border border-[#d8e0e2] rounded-lg p-[10px] grid gap-[9px] bg-[#fbfcfc]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="m-0 text-[15px]">{agent.displayName}</h2>
          <p className="mt-[3px] text-[#687578] text-[12px]">{agent.mentionHandles.join(" ")}</p>
        </div>
        <span className={`${agentStatus.base} ${enabled ? agentStatus.on : agentStatus.off}`}>{enabled ? "on" : "off"}</span>
      </div>

      <label className="grid gap-[4px] text-[#59666a] text-[12px]">
        Provider
        <select className={inputBase} value={provider} onChange={(event) => setProvider(event.target.value as AgentProvider)}>
          {providers.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-[4px] text-[#59666a] text-[12px]">
        Model
        <input className={inputBase} value={model} onChange={(event) => setModel(event.target.value)} />
      </label>

      <label className="grid gap-[4px] text-[#59666a] text-[12px]">
        Role
        <input
          className={inputBase}
          value={persona.roleDescription}
          onChange={(event) => setPersona((p) => ({ ...p, roleDescription: event.target.value }))}
        />
      </label>

      <label className="grid gap-[4px] text-[#59666a] text-[12px]">
        Personality
        <input
          className={inputBase}
          value={persona.personality}
          onChange={(event) => setPersona((p) => ({ ...p, personality: event.target.value }))}
        />
      </label>

      <label className="grid gap-[4px] text-[#59666a] text-[12px]">
        Strengths <span className="text-[#778487]">（逗号分隔）</span>
        <input className={inputBase} value={strengthsText} onChange={(event) => setStrengthsText(event.target.value)} />
      </label>

      <label className="grid gap-[4px] text-[#59666a] text-[12px]">
        Restrictions <span className="text-[#778487]">（逗号分隔）</span>
        <input className={inputBase} value={restrictionsText} onChange={(event) => setRestrictionsText(event.target.value)} />
      </label>

      <label className="grid gap-[4px] text-[#59666a] text-[12px]">
        Background
        <input
          className={inputBase}
          value={persona.background ?? ""}
          onChange={(event) => setPersona((p) => ({ ...p, background: event.target.value || undefined }))}
        />
      </label>

      <label className="grid gap-[4px] text-[#59666a] text-[12px]">
        Voice instruct
        <input
          className={inputBase}
          value={persona.voice?.instruct ?? ""}
          onChange={(event) =>
            setPersona((p) => ({ ...p, voice: { ...p.voice, instruct: event.target.value || undefined } }))
          }
        />
      </label>

      <label className="grid gap-[4px] text-[#59666a] text-[12px]">
        Signature
        <input
          className={inputBase}
          value={persona.signature ?? ""}
          onChange={(event) => setPersona((p) => ({ ...p, signature: event.target.value || undefined }))}
        />
      </label>

      <label className="flex items-center gap-2 text-[#263236]">
        <input className="w-4 h-4" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Enabled
      </label>

      <button className={saveButton} type="button" disabled={saving} onClick={() => void save()}>
        {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
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
    <article className={messageBubbleClass(message.senderType, visibility)}>
      <header className="flex items-center justify-between gap-3 mb-[6px]">
        <div className="min-w-0 inline-flex items-center flex-wrap gap-[7px]">
          <strong className="[overflow-wrap:anywhere]">{senderLabel(message)}</strong>
          <span className={`${badgeBase} ${visibilityBadge[visibility]}`}>
            {visibility === "private" ? <Lock size={12} /> : <Eye size={12} />}
            {visibility}
          </span>
          {message.revealedAt ? (
            <span className="min-h-[20px] inline-flex items-center rounded-full px-[7px] py-[1px] bg-[#e8f5ef] text-[#176348] text-[12px] leading-none">
              revealed
            </span>
          ) : null}
        </div>
        <div className="inline-flex items-center gap-2 shrink-0">
          {canReveal ? (
            <button
              className="w-[26px] h-[26px] inline-flex items-center justify-center border border-[#c7d4d8] rounded-md bg-white text-[#425158] cursor-pointer hover:bg-[#edf5f7]"
              type="button"
              onClick={onReveal}
              title="Reveal private message"
            >
              <Eye size={13} />
            </button>
          ) : null}
          <time className="text-[#778487] text-[12px]">{new Date(message.createdAt).toLocaleTimeString()}</time>
        </div>
      </header>
      {isAgentStream ? (
        <details className="border border-[#d4dee1] rounded-[7px] bg-[#f8fafb] text-[#344247] text-[12px]">
          <summary className="min-h-8 flex items-center px-[9px] cursor-pointer font-bold">CLI output</summary>
          <pre className="m-0 border-t border-[#dce4e6] p-[9px] whitespace-pre-wrap [overflow-wrap:anywhere] text-[#263236]">
            {message.content}
          </pre>
        </details>
      ) : (
        <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{message.content}</p>
      )}
      <footer className="mt-[7px] text-[#657175] text-[12px] flex flex-wrap gap-x-[9px] gap-y-[5px]">
        <span className="[overflow-wrap:anywhere]">origin: {origin}</span>
        <span className="[overflow-wrap:anywhere]">status: {deliveryStatus}</span>
        {message.mentions.length > 0 ? (
          <span className="[overflow-wrap:anywhere]">mentions: {message.mentions.join(", ")}</span>
        ) : null}
        {message.visibleToAgentIds && message.visibleToAgentIds.length > 0 ? (
          <span className="[overflow-wrap:anywhere]">visibleTo: {message.visibleToAgentIds.join(", ")}</span>
        ) : null}
        {message.revealedAt ? (
          <span className="[overflow-wrap:anywhere]">revealed: {new Date(message.revealedAt).toLocaleTimeString()}</span>
        ) : null}
      </footer>
      {message.handoffPayload ? (
        <details className="mt-2 border-t border-[rgba(125,143,148,0.28)] pt-[7px] text-[#344247] text-[12px]">
          <summary className="cursor-pointer font-bold">handoff payload</summary>
          <dl className="mt-[7px] grid grid-cols-[76px_minmax(0,1fr)] gap-x-2 gap-y-[5px]">
            <dt className="text-[#718083]">from</dt>
            <dd className="m-0 [overflow-wrap:anywhere]">{message.handoffPayload.fromAgentId}</dd>
            <dt className="text-[#718083]">to</dt>
            <dd className="m-0 [overflow-wrap:anywhere]">{message.handoffPayload.toAgentIds.join(", ")}</dd>
            <dt className="text-[#718083]">what</dt>
            <dd className="m-0 [overflow-wrap:anywhere]">{message.handoffPayload.what}</dd>
            <dt className="text-[#718083]">why</dt>
            <dd className="m-0 [overflow-wrap:anywhere]">{message.handoffPayload.why}</dd>
            <dt className="text-[#718083]">tradeoff</dt>
            <dd className="m-0 [overflow-wrap:anywhere]">{message.handoffPayload.tradeoff}</dd>
            <dt className="text-[#718083]">next</dt>
            <dd className="m-0 [overflow-wrap:anywhere]">{message.handoffPayload.nextAction}</dd>
            {message.handoffPayload.openQuestions.length > 0 ? (
              <>
                <dt className="text-[#718083]">questions</dt>
                <dd className="m-0 [overflow-wrap:anywhere]">{message.handoffPayload.openQuestions.join(" | ")}</dd>
              </>
            ) : null}
          </dl>
        </details>
      ) : null}
    </article>
  );
}

function SectionTitle({ icon, title, flush }: { icon: React.ReactNode; title: string; flush?: boolean }) {
  return (
    <div className={`${sectionTitle}${flush ? " border-b-0" : ""}`}>
      {icon}
      <span>{title}</span>
    </div>
  );
}

function StatusPill({ health, sse }: { health: string; sse: string }) {
  const ok = health === "ok" && sse === "connected";
  return (
    <div className={`${statusPill.base} ${ok ? statusPill.ok : statusPill.warn}`}>
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

function splitList(text: string): string[] {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function senderLabel(message: Message): string {
  if (message.senderType === "user") return "Guardian";
  return message.senderId ?? message.senderType;
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
