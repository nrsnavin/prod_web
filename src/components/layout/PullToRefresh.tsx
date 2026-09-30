import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { isStandalone } from "@/pwa/pwaStore";
import { cn } from "@/components/ui/cn";

// ══════════════════════════════════════════════════════════════════
//  PULL TO REFRESH, IN THE INSTALLED APP
//
//  Opened from the home screen there is no browser toolbar and so no
//  reload. Live screens poll by themselves, but lists, masters and
//  reports refresh only when the app comes back into view, and the
//  gesture people try first is to pull the page down.
//
//  It refetches the screen's DATA (every active query), not the page:
//  a reload would throw away a scroll position, open panels and the
//  app's own state to fetch the same code again.
//
//  Only in the installed app. In a browser tab, Chrome has its own
//  pull-to-refresh that reloads the page, and two would fire at once.
//  Only when the page is already at the top, and never from inside
//  something that scrolls on its own or while a dialog has locked the
//  page — a pull there means "scroll", not "refresh".
// ══════════════════════════════════════════════════════════════════

/** How far the finger must travel before letting go refreshes. */
export const PULL_THRESHOLD = 72;
/** The indicator moves at half the finger's speed, like a rubber band. */
export const pullDistance = (dy: number) => Math.max(0, Math.min(dy * 0.5, PULL_THRESHOLD * 1.4));

function scrolledAncestor(el: EventTarget | null): boolean {
  let node = el instanceof Element ? el : null;
  while (node && node !== document.body) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollTop > 0) return true;
    node = node.parentElement;
  }
  return false;
}

export function PullToRefresh({ enabled = isStandalone() }: { enabled?: boolean }) {
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const onStart = (e: TouchEvent) => {
      if (refreshing || e.touches.length !== 1) return;
      if (window.scrollY > 0 || document.body.style.overflow === "hidden") return;
      if (scrolledAncestor(e.target)) return;
      start.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const d = pullDistance(e.touches[0].clientY - start.current);
      pullRef.current = d;
      setPull(d);
    };
    const onEnd = () => {
      if (start.current === null) return;
      start.current = null;
      const go = pullRef.current >= PULL_THRESHOLD;
      pullRef.current = 0;
      setPull(0);
      if (!go) return;
      setRefreshing(true);
      qc.refetchQueries({ type: "active" }).finally(() => setRefreshing(false));
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, qc, refreshing]);

  if (!enabled || (pull === 0 && !refreshing)) return null;
  const ready = pull >= PULL_THRESHOLD;
  const offset = refreshing ? PULL_THRESHOLD * 0.6 : pull;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-30 flex justify-center"
      style={{ transform: `translateY(${offset}px)` }}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-card-hover">
        <RefreshCw
          className={cn("h-5 w-5", ready || refreshing ? "text-brand-600" : "text-ink-400", refreshing && "animate-spin")}
          style={refreshing ? undefined : { transform: `rotate(${(pull / PULL_THRESHOLD) * 270}deg)` }}
          aria-hidden
        />
        <span className="sr-only">{refreshing ? "Refreshing" : ready ? "Release to refresh" : "Pull to refresh"}</span>
      </span>
    </div>
  );
}
