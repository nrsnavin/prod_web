import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

// ══════════════════════════════════════════════════════════════════
//  "DISCARD YOUR CHANGES?" — ASKED PROPERLY
//
//  Modal and FormScreen both guarded a dirty dismissal with the native
//  window.confirm. It works, which is why it survived, but it is the
//  only dialog in the app that cannot be styled, cannot be read in the
//  app's own voice, cannot be tested, and appears bolted to the top of
//  the browser window rather than attached to the thing it is about.
//
//  ── Why this is not ConfirmDialog ────────────────────────────────
//  ConfirmDialog is built on Modal. Using it to ask whether to close a
//  Modal would mount a Modal inside a Modal — two dialogs, two focus
//  traps fighting each other, and `role="dialog"` nested inside
//  `role="dialog"`, which a screen reader has no sensible reading of.
//
//  So this is a layer INSIDE the dialog it belongs to. One dialog, one
//  focus trap, and the question visually attached to the form it is
//  asking about — which is also the honest place for it, because the
//  thing at risk is right there behind it.
//
//  ── The default answer is to keep the work ───────────────────────
//  "Keep editing" takes focus when this opens, so a reflexive Enter or
//  Space does the safe thing. Discarding is the deliberate act, and it
//  is styled as the destructive one because it is.
// ══════════════════════════════════════════════════════════════════

export function DiscardChangesPrompt({
  open,
  onDiscard,
  onKeepEditing,
}: {
  open: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    keepRef.current?.focus();

    // Escape backs out of the QUESTION, not out of the form. Letting it
    // fall through to the dialog's own handler would discard the work
    // on the second press of a key somebody is pressing to cancel.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onKeepEditing();
      }
    };
    // Capture phase: the dialog's own Escape handler is on window too,
    // and this one has to win.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onKeepEditing]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center rounded-card bg-surface/95 p-6"
      // Announced as soon as it appears: it has taken over the dialog.
      role="alertdialog"
      aria-modal="true"
      aria-label="Discard your changes?"
      // The click that opened this must not also reach the backdrop
      // behind it and close the whole dialog.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="max-w-sm text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-status-warning" />
        <h3 className="mt-3 text-base font-semibold text-ink-900">
          Discard your changes?
        </h3>
        <p className="mt-1 text-sm text-ink-500">
          What you have typed here has not been saved. Closing now throws it
          away, and there is no way to get it back.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button ref={keepRef} variant="secondary" onClick={onKeepEditing}>
            Keep editing
          </Button>
          <Button variant="danger" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      </div>
    </div>
  );
}
