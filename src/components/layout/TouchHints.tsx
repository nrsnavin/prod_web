import { useEffect, useRef, useState } from "react";

// ══════════════════════════════════════════════════════════════════
//  HINTS A FINGER CAN REACH
//
//  Across the app, what a badge, a chip or a cut-off name means is in
//  its `title` — the tooltip a mouse shows on hover. A touch screen
//  never shows it, so on a phone every one of those explanations was
//  simply gone ("Elastic changeover", the reason a figure is what it
//  is, the full text of a truncated name).
//
//  On touch screens only:
//    • a quick tap on something that is NOT itself a control shows its
//      hint in a small bubble for a few seconds;
//    • a long press on a control (a button, a link) shows its hint and
//      swallows the click that would follow, so it can be read first.
//  A plain tap on a control still does exactly what it did.
//
//  One component for every screen, rather than rewriting each hint:
//  the hints already exist and are already worded; they only needed
//  a way to be seen.
// ══════════════════════════════════════════════════════════════════

export const LONG_PRESS_MS = 500;
export const SHOW_MS = 3500;
const MOVE_TOLERANCE = 10;

const INTERACTIVE = "a[href], button, input, select, textarea, label, summary, [role='button'], [role='link'], [tabindex]:not([tabindex='-1'])";

/** The element whose hint a touch on `target` should show, if any. */
export function hintSource(target: EventTarget | null): HTMLElement | null {
  const el = target instanceof Element ? target.closest<HTMLElement>("[title]") : null;
  if (!el) return null;
  const text = el.getAttribute("title")?.trim();
  if (!text) return null;
  // An iframe's title is its accessible name, not a hint for anyone.
  if (el.tagName === "IFRAME" || el.tagName === "svg") return null;
  return el;
}

const isInteractive = (el: Element) => !!el.closest(INTERACTIVE);

interface Hint {
  text: string;
  x: number;
  y: number;
  below: boolean;
}

export function TouchHints({ enabled }: { enabled?: boolean }) {
  const [hint, setHint] = useState<Hint | null>(null);
  const timers = useRef<{ press?: number; hide?: number }>({});
  const start = useRef<{ x: number; y: number; el: HTMLElement; long: boolean } | null>(null);
  const swallowClick = useRef(false);

  useEffect(() => {
    const on =
      enabled ??
      (typeof window.matchMedia === "function" && window.matchMedia("(hover: none)").matches);
    if (!on) return;

    const show = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const below = r.top < 80;
      setHint({
        text: el.getAttribute("title")!.trim(),
        x: Math.min(Math.max(r.left + r.width / 2, 16), window.innerWidth - 16),
        y: below ? r.bottom + 8 : r.top - 8,
        below,
      });
      window.clearTimeout(timers.current.hide);
      timers.current.hide = window.setTimeout(() => setHint(null), SHOW_MS);
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const el = hintSource(e.target);
      setHint(null);
      if (!el) return;
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY, el, long: false };
      window.clearTimeout(timers.current.press);
      if (isInteractive(el)) {
        timers.current.press = window.setTimeout(() => {
          if (!start.current) return;
          start.current.long = true;
          swallowClick.current = true;
          show(el);
        }, LONG_PRESS_MS);
      }
    };
    const onMove = (e: TouchEvent) => {
      const s = start.current;
      if (!s) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - s.x) > MOVE_TOLERANCE || Math.abs(t.clientY - s.y) > MOVE_TOLERANCE) {
        window.clearTimeout(timers.current.press);
        start.current = null; // a scroll, not a tap
      }
    };
    const onEnd = () => {
      window.clearTimeout(timers.current.press);
      const s = start.current;
      start.current = null;
      if (!s || s.long) return;
      if (!isInteractive(s.el)) show(s.el);
    };
    // Capture phase, so the click a long press would fire is stopped
    // before the control's own handler sees it.
    const onClick = (e: MouseEvent) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const onScroll = () => setHint(null);

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    const t = timers.current;
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(t.press);
      window.clearTimeout(t.hide);
    };
  }, [enabled]);

  return (
    <div aria-live="polite">
      {hint && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[70] max-w-[min(18rem,calc(100vw-2rem))] rounded-lg bg-ink-900 px-3 py-2 text-xs leading-snug text-canvas shadow-card-hover motion-safe:animate-fade-in"
          style={{
            left: hint.x,
            top: hint.y,
            transform: `translate(-50%, ${hint.below ? "0" : "-100%"})`,
          }}
        >
          {hint.text}
        </div>
      )}
    </div>
  );
}
