import { useEffect, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useAccountsMutations, useAccountsSettings } from "./hooks";
import type { TallyLedgerKey } from "./types";

const LEDGERS: Array<{ key: TallyLedgerKey; label: string; placeholder?: string; hint?: string }> = [
  { key: "companyName", label: "Tally company (as named in Tally)", placeholder: "e.g. Balu Elastics 2026-27", hint: "Blank: the company name on your invoices" },
  { key: "sales", label: "Sales" }, { key: "purchase", label: "Purchase" },
  { key: "outputCgst", label: "Output CGST" }, { key: "outputSgst", label: "Output SGST" }, { key: "outputIgst", label: "Output IGST" },
  { key: "inputCgst", label: "Input CGST" }, { key: "inputSgst", label: "Input SGST" }, { key: "inputIgst", label: "Input IGST" },
  { key: "rcmCgst", label: "CGST payable on reverse charge", placeholder: "e.g. RCM CGST Payable", hint: "Blank: posts with Output CGST" },
  { key: "rcmSgst", label: "SGST payable on reverse charge", placeholder: "e.g. RCM SGST Payable", hint: "Blank: posts with Output SGST" },
  { key: "rcmIgst", label: "IGST payable on reverse charge", placeholder: "e.g. RCM IGST Payable", hint: "Blank: posts with Output IGST" },
  { key: "tdsPayable", label: "TDS payable" }, { key: "tdsReceivable", label: "TDS receivable (deducted by customers)" },
  { key: "roundOff", label: "Round off" }, { key: "bankCharges", label: "Bank charges" },
  { key: "discountAllowed", label: "Discount allowed" }, { key: "discountReceived", label: "Discount received" },
  { key: "badDebts", label: "Bad debts written off" }, { key: "writtenBack", label: "Supplier balances written back" }, { key: "sundryExpenses", label: "Expenses with no head ledger" },
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
  const [hsnDigits, setHsnDigits] = useState<4 | 6 | 8>(4);
  const [journalAbove, setJournalAbove] = useState<number | "">("");
  const [q194, setQ194] = useState<{ enabled: boolean; limit: number; rate: number }>({ enabled: false, limit: 5000000, rate: 0.1 });
  useEffect(() => {
    if (!settings) return;
    setLockDate(settings.lockDate ? settings.lockDate.slice(0, 10) : "");
    setLedgers(settings.tally ?? {});
    setVariance(settings.bills?.rateVariancePercent ?? 2);
    setHsnDigits(settings.gst?.hsnDigits ?? 4);
    setJournalAbove(settings.journals?.approvalAbove ?? 0);
    setQ194(settings.tds?.purchase194q ?? { enabled: false, limit: 5000000, rate: 0.1 });
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

      <Card className="p-5">
        <h3 className="font-semibold">GSTR-1 and journals</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Select label="HSN digits in GSTR-1" value={String(hsnDigits)} disabled={!isAdmin} onChange={(e) => setHsnDigits(Number(e.target.value) as 4 | 6 | 8)} options={[{ value: "4", label: "4 (turnover up to ₹5 crore)" }, { value: "6", label: "6 (turnover above ₹5 crore)" }, { value: "8", label: "8" }]} />
          <Input label="A journal above (₹) needs an admin" type="number" min={0} step="1000" value={journalAbove} disabled={!isAdmin} onChange={(e) => setJournalAbove(e.target.value === "" ? "" : Number(e.target.value))} hint="0: anyone in accounts may post any journal" />
        </div>
        <div className="mt-4 border-t border-ink-100 pt-3">
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5" checked={q194.enabled} disabled={!isAdmin} onChange={(e) => setQ194({ ...q194, enabled: e.target.checked })} /><span>Deduct TDS under s.194Q on purchases of goods<span className="block text-xs text-ink-400">Applies once last year's turnover crossed ₹10 crore: 0.1% on what is bought from one seller beyond ₹50 lakh in the year. A goods bill that takes a supplier past the limit carries the TDS automatically.</span></span></label>
          {q194.enabled && <div className="mt-2 grid max-w-md grid-cols-2 gap-3"><Input label="Limit per seller (₹)" type="number" min={0} value={q194.limit} disabled={!isAdmin} onChange={(e) => setQ194({ ...q194, limit: Number(e.target.value) || 0 })} /><Input label="Rate (%)" type="number" min={0} step="0.1" value={q194.rate} disabled={!isAdmin} onChange={(e) => setQ194({ ...q194, rate: Number(e.target.value) || 0 })} /></div>}
        </div>
        {isAdmin && <div className="mt-3 flex justify-end"><Button variant="secondary" loading={saveAccountsSettings.isPending} onClick={() => saveAccountsSettings.mutate({ gst: { hsnDigits }, journals: { approvalAbove: Number(journalAbove) || 0 }, tds: { purchase194q: q194 } }, { onSuccess: () => toast("Saved", "success"), onError: fail })}>Save</Button></div>}
      </Card>

      <Card className="p-5 lg:col-span-2">
        <h3 className="font-semibold">Tally ledgers</h3>
        <p className="mt-1 text-sm text-ink-500">The ledger names in your Tally company each entry posts to. Customers and suppliers post to a ledger of their own name; bank accounts and expense heads carry their own ledger name (edit them above).</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LEDGERS.map((l) => (
            <Input key={l.key} label={l.label} value={ledgers[l.key] ?? ""} placeholder={l.placeholder} hint={l.hint} disabled={!isAdmin} onChange={(e) => setLedgers((x) => ({ ...x, [l.key]: e.target.value }))} />
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
