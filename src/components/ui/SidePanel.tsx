import { ReactNode, useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** width utility for the panel, e.g. "max-w-md" (default) or "max-w-lg". */
  width?: string;
}

/**
 * SidePanel — a right-hand slide-in drawer for supplementary content
 * (details, an AI suggestion, a preview) that should sit beside the page
 * rather than take over the centre column. Backdrop dims the page,
 * clicking it or pressing Escape closes, and background scroll is locked
 * while it's open. Mounts only while open (with a brief exit animation),
 * so any data fetching inside runs lazily on first open.
 */
export function SidePanel({ open, onClose, title, children, width = "max-w-md" }: SidePanelProps) {
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      // Next frame so the enter transition actually animates from off-screen.
      const r = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setRender(false), 200); // match the transition
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!render) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [render, onClose]);

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={cn(
          "absolute inset-0 app-scrim transition-opacity duration-200",
          shown ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col bg-canvas shadow-xl transition-transform duration-200 ease-out",
          width,
          shown ? "translate-x-0" : "translate-x-full"
        )}
      >
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-ink-100 bg-surface px-4">
          <div className="min-w-0 flex-1 truncate text-base font-semibold text-ink-900">{title}</div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}
