import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { ConfirmDialog } from "./ConfirmDialog";

// ══════════════════════════════════════════════════════════════════
//  DO NOT THROW AWAY TWENTY MINUTES OF TYPING
//
//  The dirty-form guard lived in the modal components. The forms that
//  occupy a whole page — customers, elastics, employees, delivery
//  challans, job creation, the quote builder — had no equivalent, and
//  there was no navigation blocker or unload handler anywhere in the
//  codebase.
//
//  Twenty minutes into a quote with fifteen lines, a click on the
//  sidebar threw it away without a word. The protection built for the
//  small forms was missing from the long ones, which is precisely
//  backwards: the short form is the one that costs nothing to retype.
//
//  ── Two different exits, two different mechanisms ────────────────
//  Clicking a link is an in-app navigation, which react-router can
//  block and we can answer with our own dialog, in our own words.
//
//  Closing the tab or hitting reload is not ours to style: the browser
//  shows its own generic message and ignores whatever string we pass.
//  That is worth having anyway — it is the difference between losing
//  the work and being asked — so both are wired, and the fact that one
//  of them looks nothing like the other is the browser's rule, not a
//  loose end.
//
//  ── Why it takes `when` rather than reading a form itself ────────
//  Because "dirty" means different things to the six forms this guards.
//  react-hook-form tracks it as formState.isDirty; the hand-rolled
//  builders know it by comparing lines against what was loaded. The
//  caller decides; this only acts on the answer.
// ══════════════════════════════════════════════════════════════════

export interface UnsavedChangesGuardProps {
  /** True while there is unsaved work worth protecting. */
  when: boolean;
  /** What is at risk, e.g. "quotation". Used in the sentence. */
  what?: string;
}

export function UnsavedChangesGuard({ when, what = "this form" }: UnsavedChangesGuardProps) {
  // ── Leaving the app entirely ────────────────────────────────────
  // The browser's own dialog. The message is ignored by every current
  // browser; only preventDefault decides whether it appears.
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Still set for the handful of old browsers that read it.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);

  // ── Moving within the app ───────────────────────────────────────
  // Only block a navigation that actually goes somewhere else. Without
  // the location comparison this fires on a same-page search-param
  // change — typing in a filter would ask whether to discard the form.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname
  );

  return (
    <ConfirmDialog
      open={blocker.state === "blocked"}
      title="Leave without saving?"
      message={
        <>
          <p>
            You have unsaved changes to {what}. Leaving this page now discards
            them, and there is no way to get them back.
          </p>
          <p className="mt-2 text-ink-500">
            Staying keeps everything exactly as you left it.
          </p>
        </>
      }
      confirmLabel="Discard and leave"
      danger
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    />
  );
}
