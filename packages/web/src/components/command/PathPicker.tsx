"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Folder, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDirListing } from "@/hooks/useDirListing";

/**
 * 路径选择器（内联面板，非弹窗）。嵌入 CreateThreadDialog 内，
 * 避免与外层 Dialog 叠加导致 Radix modal 关闭问题。
 */
export interface PathPickerProps {
  onSelect: (path: string) => void;
  onCancel: () => void;
}

export function PathPicker({ onSelect, onCancel }: PathPickerProps) {
  const [currentPath, setCurrentPath] = useState<string | undefined>(undefined);
  const { listing, loading, error, refresh } = useDirListing(currentPath);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="grid gap-2 rounded-tower border border-tower-border-subtle bg-tower-bg-elevated p-2">
      <div className="flex items-center justify-between">
        <strong className="text-[12px] font-bold uppercase text-tower-text-secondary">选择工作目录</strong>
        <Button size="sm" variant="ghost" onClick={onCancel}>取消</Button>
      </div>

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

      <div className="max-h-55 min-h-30 overflow-auto rounded-tower border border-tower-border-subtle bg-tower-bg-panel p-1">
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

      <div className="flex items-center justify-between gap-2">
        <span className="wrap-anywhere font-mono text-[11px] text-tower-text-muted">
          {listing?.path ?? "—"}
        </span>
        <Button
          variant="solid"
          size="sm"
          disabled={!listing?.path}
          onClick={() => listing?.path && onSelect(listing.path)}
        >
          Select
        </Button>
      </div>
    </div>
  );
}
