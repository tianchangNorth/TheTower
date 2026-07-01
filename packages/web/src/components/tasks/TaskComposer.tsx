"use client";

import { useState } from "react";
import type { Agent, TaskPriority, Workspace } from "@the-tower/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/agents/Field";
import { HudPanel } from "@/components/hud/HudPanel";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { TASK_PRIORITIES } from "@/lib/tasks";

export interface TaskComposerProps {
  agents: Agent[];
  workspaces: Workspace[];
  onCreate: (input: {
    title: string;
    summary?: string;
    priority?: TaskPriority;
    tags?: string[];
    ownerAgentId?: string;
    projectPath?: string;
  }) => Promise<void>;
}

export function TaskComposer({ agents, workspaces, onCreate }: TaskComposerProps) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [owner, setOwner] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      await onCreate({
        title: title.trim(),
        summary: summary.trim() || undefined,
        priority,
        tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
        ownerAgentId: owner || undefined,
        projectPath: projectPath.trim() || undefined,
      });
      setTitle("");
      setSummary("");
      setTags("");
      setProjectPath("");
      setOwner("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <HudPanel corner className="w-[320px] shrink-0">
      <PanelHeader title="New task" />
      <div className="min-h-0 flex-1 overflow-auto p-2.5 grid gap-2">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="任务标题" />
        </Field>
        <Field label="Summary">
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Owner">
            <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">—</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Tags" hint="逗号分隔">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
        <Field label="Workspace">
          <Input
            list="task-workspaces"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            placeholder="/path/to/project"
          />
          <datalist id="task-workspaces">
            {workspaces.map((w) => (
              <option key={w.id} value={w.projectPath}>
                {w.name}
              </option>
            ))}
          </datalist>
        </Field>
        {error ? <p className="text-[11px] text-tower-accent-danger">{error}</p> : null}
        <Button variant="solid" onClick={() => void submit()} disabled={busy || !title.trim()}>
          {busy ? "Creating…" : "Create task"}
        </Button>
      </div>
    </HudPanel>
  );
}
