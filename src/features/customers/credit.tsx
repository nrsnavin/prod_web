import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { httpClient, ApiError } from "@/core/http/httpClient";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/core/auth/useAuth";
import { money } from "@/features/invoices/gst";

export interface CreditPosition {
  customer: { _id: string; name: string };
  outstanding: number;
  overdue: number;
  oldestDays: number;
  count: number;
  limit: number;
  maxOverdueDays: number;
  available: number | null;
  onHold: boolean;
  warning: string | null;
  reasons: string[];
}

export const creditService = {
  position: (customerId: string) => httpClient.get<CreditPosition & { success: boolean }>(`/customer/credit/${customerId}`),
};

export const useCreditPosition = (customerId?: string) =>
  useQuery({ queryKey: ["customer-credit", customerId], queryFn: () => creditService.position(customerId!), enabled: !!customerId, staleTime: 30_000 });

/**
 * Where the customer stands before goods leave or a bill is raised:
 * nothing when they owe nothing, a note when they do, a warning near
 * the limit, and a hold with the reason when over it.
 */
export function CreditBand({ customerId }: { customerId?: string }) {
  const { data } = useCreditPosition(customerId);
  if (!data || (data.outstanding <= 0 && !data.onHold)) return null;
  const tone = data.onHold ? "border-status-danger/40 bg-status-dangerBg text-status-danger" : data.warning ? "border-status-warning/40 bg-status-warningBg text-status-warning" : "border-ink-100 bg-ink-50 text-ink-600";
  return (
    <div role="status" aria-label="Customer credit" className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${tone}`}>
      {(data.onHold || data.warning) && <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>
        <p>
          <span className="font-semibold">{data.customer.name}</span> owes ₹{money(data.outstanding)}
          {data.overdue > 0 ? `, ₹${money(data.overdue)} past due (oldest ${data.oldestDays} days)` : ""}
          {data.limit > 0 ? ` · limit ₹${money(data.limit)}` : ""}
        </p>
        {data.onHold && <p className="font-semibold">On credit hold: {data.reasons.join("; ")}.</p>}
        {!data.onHold && data.warning && <p>{data.warning}.</p>}
      </div>
    </div>
  );
}

/**
 * Wrap a submit that may come back CREDIT_HOLD. An admin is asked for a
 * reason and the submit runs again with it; anyone else is told why.
 *
 *   const hold = useCreditHold();
 *   hold.run((creditOverride) => mutate({ ...values, creditOverride }, { onError: hold.onError }));
 *   …{hold.dialog}
 */
export function useCreditHold(what = "this") {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const last = useRef<((override?: string) => void) | null>(null);
  const isAdmin = user?.role === "admin";
  const run = (fn: (override?: string) => void) => { last.current = fn; fn(undefined); };
  /** Returns true when it handled the error. */
  const onError = (e: unknown): boolean => {
    if (e instanceof ApiError && e.code === "CREDIT_HOLD") {
      if (isAdmin) { setMessage(e.message); setOpen(true); } else toast(e.message, "error");
      return true;
    }
    return false;
  };
  const dialog = (
    <ReasonDialog open={open} onClose={() => setOpen(false)} title={`Release ${what} past the credit hold?`} description={message} confirmLabel="Release" minLength={8}
      onConfirm={(reason) => { setOpen(false); last.current?.(reason); }} />
  );
  return { run, onError, dialog };
}
