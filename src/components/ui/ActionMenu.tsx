import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./cn";

// A button that opens a short list of actions — for an action bar with
// more to offer than fits as buttons. Closes on a choice, a click outside
// or Escape; the items are real buttons, so a keyboard reaches them.

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** Shown under the label, e.g. why it is disabled. */
  hint?: string;
}

export function ActionMenu({ label, icon, items }: { label: string; icon?: ReactNode; items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (items.length === 0) return null;
  return (
    <div ref={root} className="relative">
      <Button
        size="sm"
        variant="secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {icon} {label} <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div id={id} role="menu" className="absolute left-0 z-30 mt-1 min-w-52 rounded-lg border border-ink-200 bg-surface py-1 shadow-card-hover">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => { setOpen(false); it.onSelect(); }}
              className={cn(
                "flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-ink-900 hover:bg-ink-100",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {it.icon && <span className="mt-0.5 shrink-0 text-ink-400">{it.icon}</span>}
              <span>
                {it.label}
                {it.hint && <span className="block text-xs text-ink-400">{it.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
