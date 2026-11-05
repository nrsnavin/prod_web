import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { accountsService } from "./api";
import type { Flag } from "./types";

/**
 * What the books notice about a bill or expense while it is being typed
 * — the same amount twice, a GSTIN not the supplier's, a rate off the
 * last bills — asked of the server a moment after the figures settle.
 */
export function useFlags(kind: "bill" | "expense" | "payment", body: Record<string, unknown> | null) {
  const [flags, setFlags] = useState<Flag[]>([]);
  const key = body ? JSON.stringify(body) : "";
  const seq = useRef(0);
  useEffect(() => {
    if (!body) { setFlags([]); return; }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      (kind === "bill" ? accountsService.checkBill(body) : kind === "payment" ? accountsService.checkPayment(body) : accountsService.checkExpense(body))
        .then((f) => { if (mine === seq.current) setFlags(f); })
        .catch(() => { /* a check that fails never blocks the form */ });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, key]);
  return flags;
}

const STYLE: Record<Flag["severity"], string> = {
  danger: "border-status-danger/40 bg-status-dangerBg text-status-danger",
  warning: "border-status-warning/40 bg-status-warningBg text-status-warning",
  info: "border-ink-100 bg-ink-50 text-ink-600",
};
const ICON = { danger: ShieldAlert, warning: AlertTriangle, info: Info };

export function FlagList({ flags }: { flags: Flag[] }) {
  if (!flags.length) return null;
  return (
    <ul aria-label="Checks" className="space-y-1.5">
      {flags.map((f) => {
        const I = ICON[f.severity];
        return <li key={f.code + f.message} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${STYLE[f.severity]}`}><I className="mt-0.5 h-4 w-4 shrink-0" />{f.message}</li>;
      })}
    </ul>
  );
}
