import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "./cn";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
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

  const toast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-80"
        role="status"
        aria-live="polite"
      >
        {items.map(({ id, tone, message }) => {
          const { className, Icon } = toneStyles[tone];
          return (
            <div
              key={id}
              className={cn(
                "flex items-start gap-2.5 rounded-card border bg-white p-3.5 shadow-card-hover text-sm",
                className
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", toneIconColor[tone])} />
              <span className="text-ink-900">{message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
