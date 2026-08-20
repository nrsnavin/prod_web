import { cn } from "./cn";

export interface FilterChipsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /**
   * What this row filters by.
   *
   * Optional, and omitted on a page with a single filter where the
   * chips are self-evident. Needed the moment a page shows TWO rows —
   * "warp / weft / Rubber" beside "Trim Tape / Zip Tape" is two
   * unlabelled sets of words that look like one broken list.
   */
  label?: string;
}

// Horizontal filter chip row (Zomato-style list filters).
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: FilterChipsProps<T>) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {label && (
        <span className="shrink-0 pr-0.5 text-xs font-medium uppercase tracking-wide text-ink-400">
          {label}
        </span>
      )}
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors",
            value === o.value
              ? "bg-brand-50 border-brand-500 text-brand-600"
              : "bg-surface border-ink-200 text-ink-600 hover:border-ink-400"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
