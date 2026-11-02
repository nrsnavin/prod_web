import { useEffect, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useAccountsMutations, useAccountsSettings } from "./hooks";
import type { TallyLedgerKey } from "./types";

const LEDGERS: Array<{ key: TallyLedgerKey; label: string }> = [
  { key: "companyName", label: "Tally company (as named in Tally)" },
  { key: "sales", label: "Sales" }, { key: "purchase", label: "Purchase" },
  { key: "outputCgst", label: "Output CGST" }, { key: "outputSgst", label: "Output SGST" }, { key: "outputIgst", label: "Output IGST" },
  { key: "inputCgst", label: "Input CGST" }, { key: "inputSgst", label: "Input SGST" }, { key: "inputIgst", label: "Input IGST" },
  { key: "tdsPayable", label: "TDS payable" }, { key: "tdsReceivable", label: "TDS receivable (deducted by customers)" },
  { key: "roundOff", label: "Round off" }, { key: "bankCharges", label: "Bank charges" },
  { key: "discountAllowed", label: "Discount allowed" }, { key: "discountReceived", label: "Discount received" },
  { key: "badDebts", label: "Bad debts written off" }, { key: "sundryExpenses", label: "Expenses with no head ledger" },
  { key: "debtorsGroup", label: "Group for new customers" }, { key: "creditorsGroup", label: "Group for new suppliers" },
];

/** The books lock, and the Tally ledger each kind of entry posts to. */
export function BooksSettings({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useToast();
  const { data: settings } = useAccountsSettings();
  const { lockBooks, saveAccountsSettings } = useAccountsMutations();
  const [lockDate, setLockDate] = useState("");
  const [reopen, setReopen] = useState(false);
  const [ledgers, setLedgers] = useState<Partial<Record<TallyLedgerKey, string>>>({});
  const [variance, setVariance] = useState<number | "">("");
  useEffect(() => {
    if (!settings) return;
    setLockDate(settings.lockDate ? settings.lockDate.slice(0, 10) : "");
    setLedgers(settings.tally ?? {});
    setVariance(settings.bills?.rateVariancePercent ?? 2);
  }, [settings]);
  const current = settings?.lockDate ? settings.lockDate.slice(0, 10) : "";
  const goingBack = !!current && (!lockDate || lockDate < current);
  const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : "Could not save", "error");

  return (
    <>
      <Card className="p-5">
        <h3 className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" /> Books lock</h3>
        <p className="mt-1 text-sm text-ink-500">
          {current ? <>Closed up to <span className="font-semibold">{formatDate(current)}</span>{settings?.lockedBy ? ` by ${settings.lockedBy}` : ""}. Nothing dated on or before it can be posted or cancelled.</> : "Open: entries of any date can be posted."}
        </p>
        {isAdmin ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Input label="Close the books up to" type="date" value={lockDate} onChange={(e) => setLockDate(e.target.value)} />
            <Button loading={lockBooks.isPending} disabled={lockDate === current}
              onClick={() => (goingBack ? setReopen(true) : lockBooks.mutate({ lockDate: lockDate || null }, { onSuccess: () => toast("Books locked", "success"), onError: fail }))}>
              {goingBack ? <><Unlock className="h-4 w-4" /> Reopen</> : "Lock"}
            </Button>
          </div>
        ) : <p className="mt-2 text-xs text-ink-400">An admin closes and reopens the books.</p>}
        <p className="mt-2 text-xs text-ink-400">Lock a month once it has gone to Tally, so it cannot change underneath the accountant.</p>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold">Supplier bills</h3>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Input label="A billed rate may differ from the PO by (%)" type="number" min={0} max={100} step="0.5" value={variance} disabled={!isAdmin} onChange={(e) => setVariance(e.target.value === "" ? "" : Number(e.target.value))} />
          {isAdmin && <Button variant="secondary" loading={saveAccountsSettings.isPending} onClick={() => saveAccountsSettings.mutate({ bills: { rateVariancePercent: Number(variance) || 0 } }, { onSuccess: () => toast("Saved", "success"), onError: fail })}>Save</Button>}
        </div>
        <p className="mt-2 text-xs text-ink-400">Beyond it, the bill needs a note from whoever enters it.</p>
      </Card>

      <Card className="p-5 lg:col-span-2">
        <h3 className="font-semibold">Tally ledgers</h3>
        <p className="mt-1 text-sm text-ink-500">The ledger names in your Tally company each entry posts to. Customers and suppliers post to a ledger of their own name; bank accounts and expense heads carry their own ledger name (edit them above).</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LEDGERS.map((l) => (
            <Input key={l.key} label={l.label} value={ledgers[l.key] ?? ""} disabled={!isAdmin} onChange={(e) => setLedgers((x) => ({ ...x, [l.key]: e.target.value }))} />
          ))}
        </div>
        {isAdmin && (
          <div className="mt-3 flex justify-end">
            <Button loading={saveAccountsSettings.isPending} onClick={() => saveAccountsSettings.mutate({ tally: ledgers as Record<TallyLedgerKey, string> }, { onSuccess: () => toast("Tally ledgers saved", "success"), onError: fail })}>Save ledgers</Button>
          </div>
        )}
      </Card>

      <ReasonDialog open={reopen} onClose={() => setReopen(false)} title="Reopen closed books?" description={lockDate ? `The lock moves back to ${formatDate(lockDate)}.` : "The books open for every date."} confirmLabel="Reopen" minLength={8} loading={lockBooks.isPending}
        onConfirm={(reason) => lockBooks.mutate({ lockDate: lockDate || null, reason }, { onSuccess: () => { setReopen(false); toast("Books reopened", "success"); }, onError: fail })} />
    </>
  );
}
