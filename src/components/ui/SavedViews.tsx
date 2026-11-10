import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bookmark, Check, ChevronDown, X } from "lucide-react";
import { cn } from "./cn";

// ══════════════════════════════════════════════════════════════════
//  SAVED VIEWS
//
//  A list's filters live in the address (useUrlState), so a view is just
//  a set of those values with a name: the list's own ("Late", "Open and
//  running") and each person's ("My overdue exporters"), kept in their
//  browser. Picking one sets the filters; the button names the view the
//  filters currently match, or says "Custom" when they match none.
// ══════════════════════════════════════════════════════════════════

export interface ListView {
  name: string;
  /** The filter values this view sets; anything not named is cleared. */
  params: Record<string, string>;
}

const KEY = (tableId: string) => `jarvis.views.${tableId}`;

function readSaved(tableId: string): ListView[] {
  try {
    const raw = localStorage.getItem(KEY(tableId));
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x) => x && typeof x.name === "string" && x.params && typeof x.params === "object") : [];
  } catch {
    return [];
  }
}

function writeSaved(tableId: string, views: ListView[]) {
  try {
    localStorage.setItem(KEY(tableId), JSON.stringify(views));
  } catch {
    // Private windows: the view lasts for this visit.
  }
}

const same = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a).filter((k) => a[k] !== "");
  const kb = Object.keys(b).filter((k) => b[k] !== "");
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
};

export function SavedViews({
  tableId,
  views,
  keys,
}: {
  tableId: string;
  /** The list's own views, first one being the plain list. */
  views: ListView[];
  /** The address values that make up a view (filters, search, sort). */
  keys: string[];
}) {
  const [params, setParams] = useSearchParams();
  const [saved, setSaved] = useState<ListView[]>(() => readSaved(tableId));
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const id = useId();

  const current: Record<string, string> = {};
  for (const k of keys) {
    const v = params.get(k);
    if (v) current[k] = v;
  }
  const all = [...views, ...saved];
  const match = all.find((v) => same(v.params, current));

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setNaming(false); } };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setNaming(false); } };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const apply = (v: ListView) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      for (const k of [...keys, "page"]) p.delete(k);
      for (const [k, val] of Object.entries(v.params)) if (val) p.set(k, val);
      return p;
    }, { replace: true });
    setOpen(false);
  };

  const save = () => {
    const n = name.trim();
    if (!n) return;
    const next = [...saved.filter((v) => v.name !== n), { name: n, params: current }];
    setSaved(next);
    writeSaved(tableId, next);
    setNaming(false);
    setName("");
    setOpen(false);
  };

  const remove = (n: string) => {
    const next = saved.filter((v) => v.name !== n);
    setSaved(next);
    writeSaved(tableId, next);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-3 text-sm text-ink-900 hover:bg-ink-100/60"
      >
        <Bookmark className="h-4 w-4 text-ink-400" aria-hidden />
        <span className="text-ink-500">View:</span>{" "}
        <span className="font-medium">{match?.name ?? "Custom"}</span>
        <ChevronDown className="h-4 w-4 text-ink-400" aria-hidden />
      </button>
      {open && (
        <div id={id} role="menu" aria-label="Views" className="absolute left-0 top-10 z-30 w-64 rounded-lg border border-ink-200 bg-surface p-1.5 shadow-card-hover">
          {views.map((v) => (
            <button key={v.name} type="button" role="menuitem" onClick={() => apply(v)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink-900 hover:bg-ink-100">
              <Check className={cn("h-4 w-4", match?.name === v.name ? "text-brand-600" : "invisible")} aria-hidden />
              {v.name}
            </button>
          ))}
          {saved.length > 0 && (
            <>
              <p className="mt-1 border-t border-ink-100 px-2 pb-0.5 pt-2 text-xs font-medium text-ink-500">Yours</p>
              {saved.map((v) => (
                <div key={v.name} className="group flex items-center rounded-md hover:bg-ink-100">
                  <button type="button" role="menuitem" onClick={() => apply(v)} className="flex flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm text-ink-900">
                    <Check className={cn("h-4 w-4", match?.name === v.name ? "text-brand-600" : "invisible")} aria-hidden />
                    {v.name}
                  </button>
                  <button type="button" onClick={() => remove(v.name)} aria-label={`Remove the view ${v.name}`} className="mr-1 rounded p-1 text-ink-400 hover:text-status-danger">
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </>
          )}
          <div className="mt-1 border-t border-ink-100 pt-1">
            {naming ? (
              <form className="flex gap-1.5 p-1" onSubmit={(e) => { e.preventDefault(); save(); }}>
                <input
                  autoFocus
                  aria-label="Name for this view"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. My late orders"
                  maxLength={40}
                  className="h-8 min-w-0 flex-1 rounded-md border border-ink-200 bg-surface px-2 text-sm outline-none focus:border-brand-500"
                />
                <button type="submit" disabled={!name.trim()} className="rounded-md bg-accent px-2.5 text-sm font-medium text-white disabled:opacity-50">Save</button>
              </form>
            ) : (
              <button type="button" disabled={!!match} onClick={() => setNaming(true)}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:cursor-default disabled:text-ink-400 disabled:hover:bg-transparent">
                {match ? "These filters are already a view" : "Save these filters as a view…"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
