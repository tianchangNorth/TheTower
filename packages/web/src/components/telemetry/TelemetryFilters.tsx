"use client";

import type { InvocationStatus } from "@the-tower/shared";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EVENT_TYPES, INVOCATION_STATUSES, type TelemetryUrlFilters } from "@/lib/telemetry";

function toDatetimeLocal(ms: number | undefined): string {
  return ms ? new Date(ms).toISOString().slice(0, 16) : "";
}
function fromDatetimeLocal(value: string): number | undefined {
  return value ? new Date(value).getTime() : undefined;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-tower-text-muted">
      <span className="font-bold uppercase">{label}</span>
      {children}
    </label>
  );
}

const controlClass = "h-7.5 rounded-[var(--radius-tower)] border border-tower-border-subtle bg-tower-bg-elevated px-2 text-[12px] text-tower-text-primary outline-none focus-visible:border-tower-border-energy";

export function TelemetryFilters({
  value,
  onChange,
}: {
  value: TelemetryUrlFilters;
  onChange: (patch: Partial<TelemetryUrlFilters>) => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-tower-border-subtle bg-tower-bg-panel px-3 py-2">
      <FilterField label="Agent">
        <input
          className={`${controlClass} w-40`}
          placeholder="agentId"
          value={value.agentId ?? ""}
          onChange={(e) => onChange({ agentId: e.target.value || undefined })}
        />
      </FilterField>
      <FilterField label="Status">
        <Select
          className="h-7.5"
          value={value.status ?? ""}
          onChange={(e) =>
            onChange({ status: (e.target.value || undefined) as InvocationStatus | undefined })
          }
        >
          <option value="">all</option>
          {INVOCATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </FilterField>
      <FilterField label="Event">
        <Select
          className="h-7.5"
          value={value.eventType ?? ""}
          onChange={(e) => onChange({ eventType: e.target.value || undefined })}
        >
          <option value="">all</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </FilterField>
      <FilterField label="Workspace">
        <input
          className={`${controlClass} w-40`}
          placeholder="workspace"
          value={value.workspace ?? ""}
          onChange={(e) => onChange({ workspace: e.target.value || undefined })}
        />
      </FilterField>
      <FilterField label="From">
        <input
          type="datetime-local"
          className={controlClass}
          value={toDatetimeLocal(value.from)}
          onChange={(e) => onChange({ from: fromDatetimeLocal(e.target.value) })}
        />
      </FilterField>
      <FilterField label="To">
        <input
          type="datetime-local"
          className={controlClass}
          value={toDatetimeLocal(value.to)}
          onChange={(e) => onChange({ to: fromDatetimeLocal(e.target.value) })}
        />
      </FilterField>
    </div>
  );
}
