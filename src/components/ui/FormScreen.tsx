import { ReactNode, useEffect, useRef } from "react";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "./cn";

export interface FormScreenProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** max-width utility for the centered content column, e.g. "max-w-lg" */
  width?: string;
  /** Set false to skip the "Discard your changes?" guard on dismissal. */
  confirmDirtyClose?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * FormScreen — a full-page replacement for <Modal> when the content is a
 * data-entry form. Unlike a centered modal, the whole panel is a scrollable
 * screen, so tall forms never clip the Save button below the fold (the
 * overflow bug modals had). Drop-in: same props as Modal, so a form modal
 * becomes a screen by swapping the component name.
 *
 * Layout: fixed full-screen over the app shell (z-50 clears the sidebar),
 * a sticky header with a Back affordance + title, and a scrollable body
 * that centers the form in a card at the requested max-width.
 */
export function FormScreen({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
  confirmDirtyClose = true,
}: FormScreenProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const restoreRef = useRef<HTMLElement | null>(null);

  // A stray Back/Esc must not wipe a half-filled form: once the user has
  // typed anything, dismissal asks first.
  const requestClose = () => {
    if (confirmDirtyClose && dirtyRef.current && !window.confirm("Discard your changes?")) return;
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    dirtyRef.current = false;
    restoreRef.current = document.activeElement as HTMLElement | null;

    // Lock background scroll while the screen is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the screen (first field, else the Back button).
    const t = setTimeout(() => {
      const first = bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Return focus to whatever opened the screen.
      restoreRef.current?.focus?.();
    };
    // requestClose is stable enough for this screen's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-ink-100 bg-surface px-4 lg:px-6">
        <button
          onClick={requestClose}
          className="-ml-2 flex items-center gap-1 rounded-lg p-2 text-ink-600 hover:bg-ink-100 hover:text-ink-900"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {title && <h1 className="text-base font-semibold text-ink-900">{title}</h1>}
        <button
          onClick={requestClose}
          className="ml-auto rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div
          ref={bodyRef}
          className={cn("mx-auto w-full px-4 py-6 lg:py-8", width)}
          onInput={() => {
            dirtyRef.current = true;
          }}
        >
          <div className="rounded-card bg-surface p-5 shadow-card sm:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
