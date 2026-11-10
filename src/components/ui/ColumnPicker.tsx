import { useEffect, useId, useRef, useState } from "react";
import { Columns3 } from "lucide-react";
import { cn } from "./cn";

// ══════════════════════════════════════════════════════════════════
//  WHICH COLUMNS
//
//  Each person chooses the columns a table shows; the choice is kept in
//  this browser for that table. The first column (the record's name) is
//  always shown, so a row can always be told apart.
// ══════════════════════════════════════════════════════════════════

const KEY = (tableId: string) => `jarvis.columns.${tableId}`;

function read(tableId: string | undefined): string[] | null {
  if (!tableId) return null;
  try {
    const raw = localStorage.getItem(KEY(tableId));
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}

function write(tableId: string, hidden: string[] | null) {
  try {
    if (hidden == null) localStorage.removeItem(KEY(tableId));
    else localStorage.setItem(KEY(tableId), JSON.stringify(hidden));
  } catch {
    // Private windows and full storage: the choice lasts for this visit.
  }
}

/** The columns hidden for a table: the person's choice, else the table's defaults. */
export function useHiddenColumns(tableId: string | undefined, defaults: string[]) {
  const [chosen, setChosen] = useState<string[] | null>(() => read(tableId));
  useEffect(() => setChosen(read(tableId)), [tableId]);
  const hidden = new Set(chosen ?? defaults);
  return {
    hidden,
    customised: chosen != null,
    toggle: (key: string, show: boolean) => {
      if (!tableId) return;
      const next = new Set(hidden);
      if (show) next.delete(key);
      else next.add(key);
      const list = [...next];
      setChosen(list);
      write(tableId, list);
    },
    reset: () => {
      if (!tableId) return;
      setChosen(null);
      write(tableId, null);
    },
  };
}

export function ColumnPicker({
  columns,
  hidden,
  onToggle,
  onReset,
  customised,
}: {
  columns: Array<{ key: string; header: string; locked?: boolean }>;
  hidden: ReadonlySet<string>;
  onToggle: (key: string, show: boolean) => void;
  onReset: () => void;
  customised: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={box} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-900",
          customised && "text-brand-600"
        )}
        title="Choose columns"
        aria-label="Choose columns"
      >
        <Columns3 className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div
          id={id}
          role="group"
          aria-label="Columns shown"
          className="absolute right-0 top-8 z-30 w-56 rounded-lg border border-ink-200 bg-surface p-2 text-left shadow-card-hover"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-2 pb-1 text-xs font-medium text-ink-500">Columns shown</p>
          <ul className="max-h-72 overflow-y-auto">
            {columns.filter((c) => c.header).map((c) => (
              <li key={c.key}>
                <label className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-900", c.locked ? "opacity-60" : "cursor-pointer hover:bg-ink-100")}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-500"
                    checked={!hidden.has(c.key)}
                    disabled={c.locked}
                    onChange={(e) => onToggle(c.key, e.target.checked)}
                  />
                  {c.header}
                </label>
              </li>
            ))}
          </ul>
          {customised && (
            <button type="button" onClick={onReset} className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-brand-600 hover:bg-brand-50">
              Back to the usual columns
            </button>
          )}
        </div>
      )}
    </div>
  );
}
