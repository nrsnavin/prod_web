import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "./cn";

// ══════════════════════════════════════════════════════════════════
//  TABS IN ONE ROW
//
//  A row of tabs used to scroll sideways once it outgrew the screen, so
//  the tabs past the edge were cut ("Month" for "Month end") or out of
//  sight. The row now shows the tabs that fit and puts the rest under
//  More, measured as the window changes. The open tab is always in the
//  row, so where you are is never hidden in a menu.
// ══════════════════════════════════════════════════════════════════

export interface StripTab<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

const TAB = "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors";

/** How many tabs fit beside a More button in `avail` pixels. */
export function fitCount(widths: number[], moreWidth: number, avail: number): number {
  const total = widths.reduce((a, b) => a + b, 0);
  if (total <= avail) return widths.length;
  let used = 0;
  let n = 0;
  for (const w of widths) {
    if (used + w + moreWidth > avail) break;
    used += w;
    n++;
  }
  return Math.max(1, n);
}

/** The tabs in the row and under More, the open one always in the row. */
export function splitTabs<T>(tabs: T[], fit: number, activeIndex: number): { row: T[]; more: T[] } {
  if (fit >= tabs.length) return { row: tabs, more: [] };
  if (activeIndex < fit) return { row: tabs.slice(0, fit), more: tabs.slice(fit) };
  const row = [...tabs.slice(0, Math.max(0, fit - 1)), tabs[activeIndex]];
  return { row, more: tabs.filter((t) => !row.includes(t)) };
}

export function TabStrip<T extends string>({
  tabs,
  active,
  onSelect,
  label,
  className,
}: {
  tabs: StripTab<T>[];
  active: T;
  onSelect: (id: T) => void;
  /** What the row of tabs is, for a screen reader: "Books". */
  label: string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(tabs.length);

  useLayoutEffect(() => {
    const el = box.current;
    const r = ruler.current;
    if (!el || !r) return;
    const measure = () => {
      const widths = Array.from(r.children).map((c) => (c as HTMLElement).offsetWidth);
      const more = widths.pop() ?? 0;
      // Nothing laid out (a test, a hidden tab): show them all.
      if (!el.clientWidth) return setFit(tabs.length);
      setFit(fitCount(widths, more, el.clientWidth));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs]);

  const { row, more } = splitTabs(tabs, fit, tabs.findIndex((t) => t.id === active));

  return (
    <div className={cn("relative border-b border-ink-100", className)}>
      <nav ref={box} aria-label={label} className="flex items-end gap-1">
        {row.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-current={t.id === active ? "page" : undefined}
            className={cn(TAB, t.id === active ? "border-brand-500 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-800")}
          >
            {t.icon && <t.icon className="h-4 w-4" aria-hidden />} {t.label}
          </button>
        ))}
        {more.length > 0 && <MoreTabs tabs={more} onSelect={onSelect} />}
      </nav>
      {/* The same tabs, unseen, to measure what fits. */}
      <div ref={ruler} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex h-0 overflow-hidden">
        {tabs.map((t) => (
          <span key={t.id} className={TAB}>
            {t.icon && <t.icon className="h-4 w-4" />} {t.label}
          </span>
        ))}
        <span className={TAB}>
          More <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

function MoreTabs<T extends string>({ tabs, onSelect }: { tabs: StripTab<T>[]; onSelect: (id: T) => void }) {
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
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(TAB, "border-transparent text-ink-500 hover:text-ink-800")}
      >
        More <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <div id={id} role="menu" className="absolute right-0 z-30 mt-1 min-w-52 rounded-lg border border-ink-200 bg-surface py-1 shadow-card-hover">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onSelect(t.id); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-900 hover:bg-ink-100"
            >
              {t.icon && <t.icon className="h-4 w-4 text-ink-400" aria-hidden />}
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
