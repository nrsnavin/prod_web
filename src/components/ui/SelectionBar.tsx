import { ReactNode } from "react";
import { X } from "lucide-react";

// The bar over a list while rows are ticked: how many, a way to clear,
// and what can be done with them. Sticky, so it stays in reach while the
// list scrolls.

export function SelectionBar({ count, label, onClear, children }: {
  count: number;
  /** Names the toolbar for a screen reader, e.g. "Actions on the selected challans". */
  label: string;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-card border border-brand-500/30 bg-brand-50 px-3 py-2"
    >
      <span className="text-sm font-semibold tabular-nums">{count} selected</span>
      <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-xs text-ink-600 hover:text-ink-900">
        <X className="h-3.5 w-3.5" /> Clear
      </button>
      <span className="mx-1 hidden h-5 w-px bg-ink-200 sm:block" />
      {children}
    </div>
  );
}
