"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Folder, CornerDownRight } from "lucide-react";
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
import { useDirListing } from "@/hooks/useDirListing";

export interface PathPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
}

export function PathPicker({ open, onOpenChange, onSelect }: PathPickerProps) {
  const [currentPath, setCurrentPath] = useState<string | undefined>(undefined);
  const { listing, loading, error, refresh } = useDirListing(currentPath);

  // 首次打开时拉默认目录（undefined → homedir）
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>选择工作目录</DialogTitle>
          <DialogDescription>浏览服务器文件系统的目录，仅可选目录。</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            disabled={!listing?.parent}
            onClick={() => listing?.parent && setCurrentPath(listing.parent)}
            title="返回上级"
          >
            <ArrowUp size={14} />
          </Button>
          <Input
            value={currentPath ?? listing?.path ?? ""}
            placeholder="(默认 home 目录)"
            onChange={(e) => setCurrentPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void refresh();
            }}
            className="font-mono"
          />
        </div>

        <div className="max-h-[320px] min-h-[160px] overflow-auto rounded-tower border border-tower-border-subtle bg-tower-bg-elevated p-1">
          {loading ? (
            <p className="p-2 text-[12px] text-tower-text-muted">Loading…</p>
          ) : error ? (
            <p className="p-2 text-[12px] text-tower-accent-danger">{error}</p>
          ) : !listing || listing.entries.length === 0 ? (
            <p className="p-2 text-[12px] text-tower-text-muted">No subdirectories.</p>
          ) : (
            <ul className="m-0 grid gap-0.5">
              {listing.entries.map((entry) => (
                <li key={entry.path}>
                  <button
                    type="button"
                    onClick={() => setCurrentPath(entry.path)}
                    className="flex w-full items-center gap-2 rounded-tower px-2 py-1.5 text-left text-[12px] text-tower-text-secondary transition-colors hover:bg-tower-bg-hover"
                  >
                    <Folder size={14} className="shrink-0 text-tower-accent-arc" />
                    <span className="truncate">{entry.name}</span>
                    <CornerDownRight size={12} className="ml-auto shrink-0 text-tower-text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {listing ? (
          <p className="font-mono text-[11px] text-tower-text-muted">
            current: {listing.path}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="solid"
            size="sm"
            disabled={!listing?.path}
            onClick={() => {
              if (listing?.path) {
                onSelect(listing.path);
                onOpenChange(false);
              }
            }}
          >
            Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
