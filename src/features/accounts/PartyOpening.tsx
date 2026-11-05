import { useState } from "react";
import { History, Plus, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useAccountsMutations, useOpeningBalances } from "./hooks";
import { OpeningForm, kindLabel } from "./OpeningTab";
import { money } from "./shared";
import type { OpeningBalance } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A PARTY'S OPENING BALANCE, ON THEIR OWN PAGE
//
//  What this customer or supplier owed (or had paid ahead) on the day
//  the books started here, row by row as the old ledger had it, with
//  what is still open on each; and the button to add one. The same
//  rows the Accounts → Opening tab lists for everyone at once.
// ══════════════════════════════════════════════════════════════════

const stillOpen = (o: OpeningBalance) => (o.kind === "due" ? o.amount - (o.settledAmount || 0) : o.unapplied);
const untouched = (o: OpeningBalance) => (o.settledAmount || 0) === 0 && (o.kind === "due" || o.unapplied === o.amount);

export function PartyOpening({ partyType, party, name }: { partyType: "customer" | "supplier"; party: string; name: string }) {
  const { toast } = useToast();
  const { data, isLoading, isError } = useOpeningBalances({ partyType, party, status: "posted", limit: 100 });
  const { cancelOpening } = useAccountsMutations();
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState<OpeningBalance | null>(null);
  const rows = data?.rows ?? [];
  const due = rows.filter((o) => o.kind === "due");
  const advance = rows.filter((o) => o.kind === "advance");
  const sum = (xs: OpeningBalance[], f: (o: OpeningBalance) => number) => Math.round(xs.reduce((s, o) => s + f(o), 0) * 100) / 100;

  return (
    <Card className="mt-4 p-5" aria-label="Opening balance">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 font-semibold"><History className="h-4 w-4 text-brand-500" /> Opening balance</h3>
        {rows.length > 0 && (
          <span className="text-sm text-ink-500">
            {due.length > 0 && <>{partyType === "customer" ? "owed us" : "we owed"} <span className="font-semibold tabular-nums text-ink-900">₹{money(sum(due, (o) => o.amount))}</span> · still open ₹{money(sum(due, stillOpen))}</>}
            {due.length > 0 && advance.length > 0 && " · "}
            {advance.length > 0 && <>paid ahead <span className="font-semibold tabular-nums text-ink-900">₹{money(sum(advance, (o) => o.amount))}</span> · unused ₹{money(sum(advance, stillOpen))}</>}
          </span>
        )}
        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add opening balance</Button>
      </div>
      {isLoading ? (
        <Skeleton className="mt-3 h-12 w-full" />
      ) : isError ? (
        <p className="mt-3 text-sm text-ink-400">Could not load the opening balance.</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-400">
          No opening balance entered. If {name} {partyType === "customer" ? "owed anything, or had paid ahead," : "was owed anything, or had been paid ahead,"} on the day the books started here, add it — one row per open bill from the old ledger — so the account and its ageing are right from day one.
        </p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400">
              <th className="py-2 text-left font-medium">No.</th><th className="py-2 text-left font-medium">Balance</th><th className="py-2 text-left font-medium">Old ref</th><th className="py-2 text-left font-medium">Date</th><th className="py-2 text-left font-medium">Due</th>
              <th className="py-2 text-right font-medium">Amount (₹)</th><th className="py-2 text-right font-medium">Still open (₹)</th><th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((o) => (
              <tr key={o._id}>
                <td className="py-1.5 font-medium">{o.docNo}</td>
                <td className="py-1.5"><StatusChip tone={o.kind === "due" ? "warning" : "info"}>{kindLabel(o)}</StatusChip></td>
                <td className="py-1.5">{o.refNo || "—"}</td>
                <td className="py-1.5">{formatDate(o.date)}</td>
                <td className="py-1.5">{o.dueDate ? formatDate(o.dueDate) : "—"}</td>
                <td className="py-1.5 text-right tabular-nums">{money(o.amount)}</td>
                <td className="py-1.5 text-right tabular-nums">{money(stillOpen(o))}</td>
                <td className="py-1.5 text-right">{untouched(o) && <Button size="sm" variant="ghost" aria-label={`Cancel ${o.docNo}`} onClick={() => setCancelling(o)}><XCircle className="h-4 w-4" /></Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {adding && <OpeningForm fixed={{ partyType, id: party, name }} onClose={() => setAdding(false)} />}
      <ReasonDialog open={!!cancelling} onClose={() => setCancelling(null)} title={`Cancel ${cancelling?.docNo}?`} description={`It leaves ${name}'s account.`} confirmLabel="Cancel balance" minLength={8} loading={cancelOpening.isPending}
        onConfirm={(reason) => cancelling && cancelOpening.mutate({ id: cancelling._id, reason }, { onSuccess: () => { setCancelling(null); toast("Cancelled", "success"); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not cancel", "error") })} />
    </Card>
  );
}
