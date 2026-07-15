import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** max-width utility, e.g. "max-w-lg" */
  width?: string;
  /** Set false for non-form dialogs (search palette) so typing never triggers the discard prompt */
  confirmDirtyClose?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, children, width = "max-w-lg", confirmDirtyClose = true }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const restoreRef = useRef<HTMLElement | null>(null);

  // A stray backdrop click or Esc must not wipe a half-filled form:
  // once the user has typed anything, dismissal asks first.
  const requestClose = () => {
    if (confirmDirtyClose && dirtyRef.current && !window.confirm("Discard your changes?")) return;
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    dirtyRef.current = false;
    restoreRef.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog (first field, else close button).
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        className={cn("w-full bg-white rounded-card shadow-card-hover flex flex-col max-h-[85vh]", width)}
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
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
