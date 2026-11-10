import { ReactNode, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";
import { DiscardChangesPrompt } from "./DiscardChangesPrompt";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** max-width utility, e.g. "max-w-lg" */
  width?: string;
  /** Set false for non-form dialogs (search palette) so typing never triggers the discard prompt */
  confirmDirtyClose?: boolean;
  /**
   * "sheet" (default): on a phone the dialog rises from the bottom, where
   * the thumb is. "top": stays near the top on every screen — for the
   * search palette, whose results the phone keyboard would cover.
   */
  placement?: "sheet" | "top";
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FIELDS =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';

/** Focus the first of these that can actually take focus (a `hidden` one can't). */
function focusFirst(nodes: Iterable<HTMLElement>): boolean {
  for (const el of nodes) {
    el.focus();
    if (document.activeElement === el) return true;
  }
  return false;
}

/**
 * Where focus starts when a dialog opens.
 *
 * It used to be the first focusable thing, which is the header's close
 * button. Two things went wrong with that. A dialog with a field made
 * the user click into it before typing. And a field that had already
 * taken focus itself (the reason box) was blurred straight away, which
 * is what made every reason dialog open showing its error.
 *
 * So: a field that already has focus keeps it; then anything marked
 * `data-autofocus`; then, with a mouse or keyboard, the first field in
 * the body, else the first button there, which in a confirmation is the
 * safe "Cancel". On a touch screen a field is skipped, so the keyboard
 * doesn't cover the sheet the moment it opens.
 */
function placeFocus(panel: HTMLElement, body: HTMLElement | null) {
  if (panel.contains(document.activeElement)) return;
  const touch =
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const all = (root: ParentNode, sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
  if (focusFirst(all(panel, "[data-autofocus]"))) return;
  if (!touch && body && (focusFirst(all(body, FIELDS)) || focusFirst(all(body, FOCUSABLE)))) return;
  focusFirst(all(panel, FOCUSABLE));
}

export function Modal({ open, onClose, title, children, width = "max-w-lg", confirmDirtyClose = true, placement = "sheet" }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [asking, setAsking] = useState(false);

  // A stray backdrop click or Esc must not wipe a half-filled form:
  // once the user has typed anything, dismissal asks first.
  //
  // Was window.confirm — the only dialog in the app that could not be
  // styled, read in the app's voice, or tested. It is now a layer
  // inside this dialog rather than a nested Modal, because a Modal
  // inside a Modal means two focus traps and role="dialog" nested in
  // role="dialog".
  const requestClose = () => {
    if (confirmDirtyClose && dirtyRef.current) {
      setAsking(true);
      return;
    }
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    dirtyRef.current = false;
    setAsking(false);
    restoreRef.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog; see placeFocus for where it lands.
    const t = setTimeout(() => {
      if (panelRef.current) placeFocus(panelRef.current, bodyRef.current);
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        requestClose();
        return;
      }
      // Trap Tab inside the dialog.
      if (e.key === "Tab" && panelRef.current) {
        const nodes = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      // Return focus to whatever opened the dialog.
      restoreRef.current?.focus?.();
    };
    // requestClose is stable enough for this dialog lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center app-scrim",
        placement === "sheet"
          ? "items-end sm:items-start sm:p-4 sm:pt-[10vh]"
          : "items-start p-4 pt-[10vh]"
      )}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        className={cn(
          // `relative` so the discard prompt can cover this panel and
          // nothing else.
          "relative w-full bg-surface rounded-card shadow-card-hover flex flex-col max-h-[85vh]",
          // A sheet on a phone: square bottom, rounded top, clear of the
          // home bar, sliding up unless the phone asks for less motion.
          placement === "sheet" &&
            "max-sm:max-w-none rounded-b-none rounded-t-2xl pb-[env(safe-area-inset-bottom)] motion-safe:animate-sheet-up sm:rounded-card sm:pb-0 sm:motion-safe:animate-none",
          width
        )}
        onInput={() => {
          dirtyRef.current = true;
        }}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 shrink-0">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              onClick={requestClose}
              className="p-1 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {/* Body scrolls when a dialog is taller than the viewport, so the
            content below the fold (e.g. a Save button) is always reachable. */}
        <div ref={bodyRef} className="p-5 overflow-y-auto">{children}</div>

        <DiscardChangesPrompt
          open={asking}
          onKeepEditing={() => setAsking(false)}
          onDiscard={() => { setAsking(false); onClose(); }}
        />
      </div>
    </div>
  );
}
