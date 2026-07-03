"use client";

import { useState } from "react";
import type { Thread, ThreadMode } from "@the-tower/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/agents/Field";
import { PathPicker } from "./PathPicker";
import { useTowerClient } from "@/hooks/useTowerClient";

export interface CreateThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (thread: Thread) => void;
}

export function CreateThreadDialog({ open, onOpenChange, onCreated }: CreateThreadDialogProps) {
  const client = useTowerClient();
  const [title, setTitle] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [mode, setMode] = useState<ThreadMode>("play");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function reset() {
    setTitle("");
    setProjectPath("");
    setMode("play");
    setPickerOpen(false);
    setError(undefined);
  }

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const { thread } = await client.createThread({
        title: title.trim(),
        projectPath: projectPath.trim() || undefined,
        mode,
      });
      reset();
      onCreated(thread);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New thread</DialogTitle>
          <DialogDescription>命名并选择工作目录，创建后进入 Command 工作台。</DialogDescription>
        </DialogHeader>

        {pickerOpen ? (
          <PathPicker
            onSelect={(path) => {
              setProjectPath(path);
              setPickerOpen(false);
            }}
            onCancel={() => setPickerOpen(false)}
          />
        ) : (
          <>
            <Field label="Thread name">
              <Input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="任务 / 会话标题"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
              />
            </Field>

            <Field label="Workspace path">
              <div className="flex items-center gap-2">
                <Input
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="/path/to/project"
                  className="font-mono"
                />
                <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                  Browse…
                </Button>
              </div>
            </Field>

            <Field label="Mode">
              <Select value={mode} onChange={(e) => setMode(e.target.value as ThreadMode)}>
                <option value="debug">debug</option>
                <option value="play">play</option>
              </Select>
            </Field>

            {error ? <p className="text-[11px] text-tower-accent-danger">{error}</p> : null}
          </>
        )}

        <DialogFooter>
          {pickerOpen ? null : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button variant="solid" size="sm" onClick={() => void submit()} disabled={busy || !title.trim()}>
                {busy ? "Creating…" : "Create"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
