import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "./cn";

// ══════════════════════════════════════════════════════════════════
//  A MESSAGE THAT DELETES ITSELF IS NOT A MESSAGE
//
//  Every toast used to be dismissed on the same 3.5 second timer,
//  whatever it said. A success and a failure were treated identically,
//  and there was no history — once it was gone there was no way to see
//  what it had said.
//
//  Consider where this software runs. Somebody taps Save, a loom needs
//  attention, they look up for four seconds. The write failed, the
//  message is gone, and the screen shows the form exactly as it did
//  before. They will believe it saved. That is not a missed
//  notification; it is the interface asserting something false.
//
//  So the rule is now about consequence, not uniformity:
//
//    • success and info still leave on their own. Nothing is lost if
//      they are missed — the thing they describe has already happened,
//      and the screen shows it.
//    • an error STAYS until somebody dismisses it, and carries a close
//      button so dismissing it is a deliberate act. The one message
//      that costs something to miss is the one that used to vanish
//      fastest.
//
//  Errors are also announced assertively rather than politely: a
//  screen reader should interrupt for a failure, and wait its turn for
//  a confirmation. That is two live regions, because the politeness of
//  a region is fixed when it is created and cannot be varied per item.
// ══════════════════════════════════════════════════════════════════

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  toast: (message: string, tone?: ToastTone) => void;
  /** Remove every toast currently on screen. Used when a view unmounts. */
  dismissAll: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/** How long a toast that is safe to miss stays on screen. */
export const AUTO_DISMISS_MS = 3500;

/** Tones that leave on their own. Anything else waits to be dismissed. */
const AUTO_DISMISS: ToastTone[] = ["success", "info"];

export function toneAutoDismisses(tone: ToastTone): boolean {
  return AUTO_DISMISS.includes(tone);
}

const toneStyles: Record<ToastTone, { className: string; Icon: typeof Info }> = {
  success: { className: "border-status-success/30", Icon: CheckCircle2 },
  error: { className: "border-status-danger/30", Icon: AlertCircle },
  info: { className: "border-status-info/30", Icon: Info },
};

const toneIconColor: Record<ToastTone, string> = {
  success: "text-status-success",
  error: "text-status-danger",
  info: "text-status-info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  // Cleared on unmount so a timer cannot fire into a dead component.
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, tone, message }]);

      // Only the tones that cost nothing to miss are put on a timer.
      if (toneAutoDismisses(tone)) {
        const handle = window.setTimeout(() => {
          setItems((prev) => prev.filter((t) => t.id !== id));
        }, AUTO_DISMISS_MS);
        timers.current.push(handle);
      }
    },
    []
  );

  const dismissAll = useCallback(() => setItems([]), []);

  useEffect(
    () => () => {
      timers.current.forEach((h) => window.clearTimeout(h));
      timers.current = [];
    },
    []
  );

  const api = useMemo(() => ({ toast, dismissAll }), [toast, dismissAll]);

  const errors = items.filter((t) => t.tone === "error");
  const rest = items.filter((t) => t.tone !== "error");

  const card = ({ id, tone, message }: ToastItem) => {
    const { className, Icon } = toneStyles[tone];
    const persistent = !toneAutoDismisses(tone);
    return (
      <div
        key={id}
        className={cn(
          "flex items-start gap-2.5 rounded-card border bg-surface p-3.5 shadow-card-hover text-sm",
          className
        )}
      >
        <Icon className={cn("h-5 w-5 shrink-0", toneIconColor[tone])} />
        <span className="text-ink-900 flex-1">{message}</span>
        {/* Only on the ones that will not leave by themselves — a close
            button on a toast that is already going is one more thing to
            read and decide about. */}
        {persistent && (
          <button
            type="button"
            onClick={() => dismiss(id)}
            aria-label="Dismiss message"
            className="-m-1 shrink-0 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {/* Two regions, because a region's politeness is fixed when it
            is created. A failure should interrupt; a confirmation
            should wait its turn. */}
        <div role="alert" aria-live="assertive" className="flex flex-col gap-2">
          {errors.map(card)}
        </div>
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          {rest.map(card)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
