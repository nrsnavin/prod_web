import { ChevronRight } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { ENTRY_LABEL } from "./floorRules";
import type { EntryState, FloorMachine } from "./types";

const TONE: Record<EntryState, ChipTone> = {
  free: "neutral",
  loading: "info",
  unplanned: "warning",
  ready: "warning",
  entered: "success",
  verified: "success",
  locked: "neutral",
};

/** The chip that says where a loom stands this shift. */
export function EntryChip({ entry }: { entry: EntryState }) {
  return <StatusChip tone={TONE[entry]}>{ENTRY_LABEL[entry]}</StatusChip>;
}

/** One line of the loom's heads: "1 20mm White · 2 20mm White · 3 free". */
export function HeadMap({ machine, className }: { machine: FloorMachine; className?: string }) {
  if (!machine.headMap.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Heads">
      {machine.headMap.map((h) => (
        <li
          key={h.head}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs",
            h.elastic ? "border-ink-200 bg-surface text-ink-900" : "border-dashed border-ink-200 text-ink-400"
          )}
        >
          <span className="font-semibold tabular-nums text-ink-500">{h.head + 1}</span>
          <span className="max-w-[9rem] truncate">{h.elastic ? h.elastic.name ?? "elastic" : "free"}</span>
        </li>
      ))}
    </ul>
  );
}

/** A loom in the list: tap to open it. */
export function LoomRow({ machine, onOpen }: { machine: FloorMachine; onOpen: (m: FloorMachine) => void }) {
  const s = machine.detail?.submitted;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(machine)}
        className="flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-left transition-colors hover:border-ink-400 active:bg-ink-100"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-base font-bold tabular-nums">{machine.ID}</span>
            <span className="truncate text-sm text-ink-500">{machine.job ? machine.job.no : "no job"}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink-400">
            {machine.detail?.operator?.name ?? (machine.entry === "unplanned" ? "no operator yet" : machine.manufacturer)}
            {s && s.production != null && ` · ${s.production} m/head${s.timer ? ` · ${s.timer}` : ""}`}
          </span>
        </span>
        <EntryChip entry={machine.entry} />
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" aria-hidden />
      </button>
    </li>
  );
}
