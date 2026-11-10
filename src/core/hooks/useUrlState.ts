import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// ══════════════════════════════════════════════════════════════════
//  FILTERS THAT LIVE IN THE ADDRESS
//
//  A list's filter, search, tab and page used to be component state, so
//  a refresh, the back button or a shared link put the reader back at
//  "All, page 1". These keep them in the URL's query string instead:
//  the default value is left out, so a plain list keeps a plain link,
//  and changes replace the history entry rather than adding one per
//  keystroke.
// ══════════════════════════════════════════════════════════════════

/** A string value, optionally limited to a known set (anything else reads as the fallback). */
export function useUrlState<T extends string>(
  key: string,
  fallback: T,
  allowed?: readonly T[]
): [T, (next: T, also?: Record<string, string | null>) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const value = (raw != null && (!allowed || (allowed as readonly string[]).includes(raw)) ? raw : fallback) as T;
  const set = useCallback(
    (next: T, also?: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === fallback || next === "") p.delete(key);
          else p.set(key, next);
          // Companion changes in the same step, e.g. back to page 1.
          for (const [k, v] of Object.entries(also ?? {})) {
            if (v == null || v === "") p.delete(k);
            else p.set(k, v);
          }
          return p;
        },
        { replace: true }
      );
    },
    [key, fallback, setParams]
  );
  return [value, set];
}

/** A whole number, such as a page. Anything unreadable reads as the fallback. */
export function useUrlNumber(key: string, fallback: number): [number, (next: number) => void] {
  const [raw, setRaw] = useUrlState<string>(key, String(fallback));
  const n = Number.parseInt(raw, 10);
  const value = Number.isFinite(n) && n > 0 ? n : fallback;
  const set = useCallback((next: number) => setRaw(String(next)), [setRaw]);
  return [value, set];
}

/** A yes/no switch, present in the URL only when on. */
export function useUrlFlag(key: string): [boolean, (on: boolean) => void] {
  const [raw, setRaw] = useUrlState<string>(key, "");
  const set = useCallback((on: boolean) => setRaw(on ? "1" : ""), [setRaw]);
  return [raw === "1", set];
}
