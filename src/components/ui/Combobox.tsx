import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "./cn";

export interface ComboOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  label?: string;
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  /** Accessible name when there's no visible `label` (e.g. a table row). */
  "aria-label"?: string;
}

// Searchable dropdown for large masters (customers, elastics, materials…):
// type to filter, arrow keys + Enter to pick, Esc to dismiss. Drop-in
// replacement for Select on forms via react-hook-form's Controller.
export function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder = "Select…",
  error,
  "aria-label": ariaLabel,
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => setActive(0), [query, open]);

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

  const pick = (v: string) => {
    onChange(v);
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
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active].value);
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
            "w-full h-10 px-3 rounded-lg border bg-white text-sm text-left flex items-center gap-2",
            "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
            "disabled:opacity-50",
            error ? "border-status-danger" : "border-ink-200",
            selected ? "text-ink-900" : "text-ink-400"
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
        >
          <span className="flex-1 truncate">{selected?.label ?? placeholder}</span>
          <ChevronDown className="h-4 w-4 text-ink-400 shrink-0" />
        </button>

        {open && (
          <div className="absolute z-30 mt-1 w-full rounded-lg border border-ink-200 bg-white shadow-card-hover">
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
            </div>
            <ul ref={listRef} role="listbox" className="max-h-56 overflow-y-auto py-1">
              {filtered.map((o, i) => (
                <li key={o.value} data-idx={i}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    onClick={() => pick(o.value)}
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
              {filtered.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-ink-400">No matches</li>
              )}
            </ul>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-status-danger">{error}</p>}
    </div>
  );
}
