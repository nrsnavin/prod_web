import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Search, Loader2 } from "lucide-react";
import { cn } from "./cn";
import type { ComboOption } from "./Combobox";

export interface AsyncComboboxProps {
  label?: string;
  /** Accessible name when there is no visible `label`. */
  "aria-label"?: string;
  value: string;
  onChange: (value: string) => void;
  // Fetches options from the server for the current query. Called on open
  // (empty query) and, debounced, as the user types — so the full dataset
  // is searchable without loading it all up front.
  loadOptions: (query: string) => Promise<ComboOption[]>;
  // Known value→label pairs so preset or programmatically-set values render
  // their label even before they appear in a search result (edit prefill,
  // "add from group", etc.).
  seedOptions?: ComboOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  emptyText?: string;
}

// Server-searched variant of Combobox for large masters (customers,
// elastics) where the full list can exceed the API's page cap. Same
// keyboard/visual behaviour as Combobox; results come from `loadOptions`.
export function AsyncCombobox({
  label,
  value,
  onChange,
  loadOptions,
  seedOptions,
  placeholder = "Select…",
  "aria-label": ariaLabel,
  error,
  disabled,
  className,
  emptyText = "No matches",
}: AsyncComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [options, setOptions] = useState<ComboOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reqId = useRef(0);
  // Accumulates every label we've seen so the selected value can be shown
  // even when it isn't in the current result set.
  const labelCache = useRef<Map<string, string>>(new Map());

  // Fold seed options into the cache.
  useEffect(() => {
    for (const o of seedOptions ?? []) labelCache.current.set(o.value, o.label);
  }, [seedOptions]);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    return labelCache.current.get(value) ?? null;
  }, [value, options, seedOptions]);

  // Debounce the typed query.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  // Fetch when open or the debounced query changes.
  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    setLoading(true);
    loadOptions(debounced)
      .then((opts) => {
        if (id !== reqId.current) return; // stale response
        for (const o of opts) labelCache.current.set(o.value, o.label);
        setOptions(opts);
      })
      .catch(() => {
        if (id === reqId.current) setOptions([]);
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, [open, debounced, loadOptions]);

  useEffect(() => setActive(0), [options, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const pick = (o: ComboOption) => {
    labelCache.current.set(o.value, o.label);
    onChange(o.value);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) pick(options[active]);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div className={cn("space-y-1.5", className)} ref={rootRef}>
      {label && <label className="block text-sm font-medium text-ink-600">{label}</label>}
      <div className="relative" onKeyDown={onKeyDown}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen((v) => !v);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className={cn(
            "w-full h-10 px-3 rounded-lg border bg-surface text-sm text-left flex items-center gap-2",
            "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
            "disabled:opacity-50",
            error ? "border-status-danger" : "border-ink-200",
            selectedLabel ? "text-ink-900" : "text-ink-400"
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
        >
          <span className="flex-1 truncate">{selectedLabel ?? placeholder}</span>
          <ChevronDown className="h-4 w-4 text-ink-400 shrink-0" />
        </button>

        {open && (
          <div className="absolute z-30 mt-1 w-full rounded-lg border border-ink-200 bg-surface shadow-card-hover">
            <div className="flex items-center gap-2 border-b border-ink-100 px-3 py-2">
              <Search className="h-4 w-4 text-ink-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={ariaLabel ? `Search ${ariaLabel}` : "Search options"}
                placeholder="Type to search…"
                className="w-full text-sm outline-none placeholder:text-ink-400"
              />
              {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-400" />}
            </div>
            <ul ref={listRef} role="listbox" className="max-h-56 overflow-y-auto py-1">
              {options.map((o, i) => (
                <li key={o.value} data-idx={i}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    onClick={() => pick(o)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                      i === active ? "bg-brand-50 text-brand-600" : "text-ink-900"
                    )}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.value === value && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              ))}
              {!loading && options.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-ink-400">
                  {debounced ? emptyText : "Type to search…"}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-status-danger">{error}</p>}
    </div>
  );
}
