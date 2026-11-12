import { useEffect, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useAccountsMutations, useAccountsSettings, useLockHistory } from "./hooks";
import type { LockEvent, TallyLedgerKey } from "./types";

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
  { key: "salaries", label: "Salaries & wages" }, { key: "salaryPayable", label: "Salary payable" }, { key: "pfPayable", label: "PF payable" }, { key: "esiPayable", label: "ESI payable" }, { key: "staffAdvances", label: "Staff advances" },
  { key: "depreciation", label: "Depreciation" }, { key: "accumulatedDepreciation", label: "Accumulated depreciation" },
  { key: "stockInHand", label: "Stock-in-hand (closing stock asset)" }, { key: "closingStock", label: "Closing stock (P&L side)" },
  { key: "exportSales", label: "Export / SEZ sales" }, { key: "interestReceived", label: "Interest received" }, { key: "chequeCharges", label: "Cheque return charges" },
];

/** The books lock, and the Tally ledger each kind of entry posts to. */
export function BooksSettings({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useToast();
  const { data: settings } = useAccountsSettings();
  const { lockBooks, saveAccountsSettings } = useAccountsMutations();
  const [lockDate, setLockDate] = useState("");
  const [reopen, setReopen] = useState(false);
  // Closing the books stops every entry on or before the date, so the
  // button asks first; reopening already asks for a reason.
  const [closing, setClosing] = useState(false);
  const [ledgers, setLedgers] = useState<Partial<Record<TallyLedgerKey, string>>>({});
  const [variance, setVariance] = useState<number | "">("");
  const [hsnDigits, setHsnDigits] = useState<4 | 6 | 8>(4);
  const [journalAbove, setJournalAbove] = useState<number | "">("");
  const [q194, setQ194] = useState<{ enabled: boolean; limit: number; rate: number }>({ enabled: false, limit: 5000000, rate: 0.1 });
  const [ccTally, setCcTally] = useState(false);
  const [interest, setInterest] = useState<{ interestRate: number | ""; graceDays: number | ""; interestBasis: "balance" | "payments" }>({ interestRate: "", graceDays: "", interestBasis: "balance" });
  const [lut, setLut] = useState<{ number: string; validFrom: string; validTo: string }>({ number: "", validFrom: "", validTo: "" });
  useEffect(() => {
    if (!settings) return;
    setLockDate(settings.lockDate ? settings.lockDate.slice(0, 10) : "");
    setLedgers(settings.tally ?? {});
    setVariance(settings.bills?.rateVariancePercent ?? 2);
    setHsnDigits(settings.gst?.hsnDigits ?? 4);
    setJournalAbove(settings.journals?.approvalAbove ?? 0);
    setQ194(settings.tds?.purchase194q ?? { enabled: false, limit: 5000000, rate: 0.1 });
    setCcTally(!!settings.costCentres?.tally);
    setInterest({ interestRate: settings.receivables?.interestRate ?? 0, graceDays: settings.receivables?.graceDays ?? 0, interestBasis: settings.receivables?.interestBasis ?? "balance" });
    setLut({ number: settings.lut?.number ?? "", validFrom: settings.lut?.validFrom ? settings.lut.validFrom.slice(0, 10) : "", validTo: settings.lut?.validTo ? settings.lut.validTo.slice(0, 10) : "" });
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
              onClick={() => (goingBack ? setReopen(true) : setClosing(true))}>
              {goingBack ? <><Unlock className="h-4 w-4" /> Reopen…</> : <><Lock className="h-4 w-4" /> Close books…</>}
            </Button>
          </div>
        ) : <p className="mt-2 text-xs text-ink-400">An admin closes and reopens the books.</p>}
        <p className="mt-2 text-xs text-ink-400">Lock a month once it has gone to Tally, so it cannot change underneath the accountant.</p>
        <LockHistory />
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

      <Card className="p-5">
        <h3 className="font-semibold">Interest, exports and cost centres</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Input label="Interest on overdue invoices (% a year)" type="number" min={0} max={100} step="0.5" value={interest.interestRate} disabled={!isAdmin} onChange={(e) => setInterest({ ...interest, interestRate: e.target.value === "" ? "" : Number(e.target.value) })} hint="0: none. A customer's own rate wins." />
          <Input label="Grace days past due" type="number" min={0} max={365} value={interest.graceDays} disabled={!isAdmin} onChange={(e) => setInterest({ ...interest, graceDays: e.target.value === "" ? "" : Number(e.target.value) })} />
          <div>
            <Select label="Interest is worked on" value={interest.interestBasis} disabled={!isAdmin} onChange={(e) => setInterest({ ...interest, interestBasis: e.target.value === "payments" ? "payments" : "balance" })}
              options={[{ value: "balance", label: "What the invoice still owes today" }, { value: "payments", label: "Each part, for the days it was unpaid" }]} />
            <p className="mt-1 text-xs text-ink-400">{interest.interestBasis === "payments" ? "An invoice paid late is charged for its lateness, even when it is paid in full by now." : "An invoice paid late in full bears no interest; a part paid late is not charged for those days."}</p>
          </div>
          <Input label="LUT number (exports without IGST)" value={lut.number} disabled={!isAdmin} onChange={(e) => setLut({ ...lut, number: e.target.value.toUpperCase() })} placeholder="AD330326000123K" hint="The Letter of Undertaking on the GST portal, one a year" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valid from" type="date" value={lut.validFrom} disabled={!isAdmin} onChange={(e) => setLut({ ...lut, validFrom: e.target.value })} />
            <Input label="Valid to" type="date" value={lut.validTo} disabled={!isAdmin} onChange={(e) => setLut({ ...lut, validTo: e.target.value })} />
          </div>
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5" checked={ccTally} disabled={!isAdmin} onChange={(e) => setCcTally(e.target.checked)} /><span>Send cost centres to Tally<span className="block text-xs text-ink-400">Each bill's and expense's cost centre (an order, a machine, a department) goes on the voucher as a cost-centre allocation. Switch on cost centres in the Tally company first.</span></span></label>
        {isAdmin && <div className="mt-3 flex justify-end"><Button variant="secondary" loading={saveAccountsSettings.isPending} onClick={() => saveAccountsSettings.mutate({ costCentres: { tally: ccTally }, receivables: { interestRate: Number(interest.interestRate) || 0, graceDays: Number(interest.graceDays) || 0, interestBasis: interest.interestBasis }, lut: { number: lut.number, validFrom: lut.validFrom || null, validTo: lut.validTo || null } }, { onSuccess: () => toast("Saved", "success"), onError: fail })}>Save</Button></div>}
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

      <ConfirmDialog
        open={closing && !!lockDate}
        title={lockDate ? `Close the books up to ${formatDate(lockDate)}?` : "Close the books?"}
        message="Do this once the period has gone to Tally, so it can't change underneath the accountant."
        consequences={[
          { text: <>Nothing dated on or before <span className="font-semibold">{lockDate ? formatDate(lockDate) : ""}</span> can be posted, edited or cancelled.</>, tone: "warning" },
          ...(current ? [{ text: <>The lock moves forward from {formatDate(current)}.</> }] : []),
          { text: "Reopening later needs an admin and a reason, saved to the audit trail." },
        ]}
        confirmLabel={lockDate ? `Close books to ${formatDate(lockDate)}` : "Close books"}
        cancelLabel="Not now"
        loading={lockBooks.isPending}
        onCancel={() => setClosing(false)}
        onConfirm={() => lockBooks.mutate({ lockDate: lockDate || null }, { onSuccess: () => { setClosing(false); toast("Books closed", "success"); }, onError: fail })}
      />
      <ReasonDialog open={reopen} onClose={() => setReopen(false)} title="Reopen closed books?" description={lockDate ? `The lock moves back to ${formatDate(lockDate)}.` : "The books open for every date."} confirmLabel="Reopen" minLength={8} loading={lockBooks.isPending}
        onConfirm={(reason) => lockBooks.mutate({ lockDate: lockDate || null, reason }, { onSuccess: () => { setReopen(false); toast("Books reopened", "success"); }, onError: fail })} />
    </>
  );
}

const LOCK_KIND: Record<LockEvent["kind"], string> = { closed: "Closed", moved: "Moved", reopened: "Reopened", override: "Let through" };

/**
 * What has happened to the lock: each time the books were closed, moved
 * or reopened, and each entry an admin let through it, with who and why.
 * Folded away until asked for.
 */
function LockHistory() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useLockHistory(open);
  return (
    <div className="mt-3 border-t border-ink-100 pt-3">
      <button type="button" className="text-sm font-medium text-brand-600 hover:underline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Hide the lock's history" : "Show the lock's history"}</button>
      {open && (isLoading ? <p className="mt-2 text-sm text-ink-400">Loading…</p> : !data?.length ? <p className="mt-2 text-sm text-ink-400">Nothing yet: the books have not been closed.</p> : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm" aria-label="Lock history">
            <thead><tr className="text-left text-xs text-ink-500"><th className="py-1 pr-3 font-medium">When</th><th className="py-1 pr-3 font-medium">What</th><th className="py-1 pr-3 font-medium">By</th><th className="py-1 font-medium">Why</th></tr></thead>
            <tbody>
              {data.map((e) => (
                <tr key={e._id} className="border-t border-ink-100 align-top">
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">{formatDate(e.at)}</td>
                  <td className="py-1.5 pr-3">
                    {e.kind === "override"
                      ? <>{LOCK_KIND.override}: {e.entry?.cancelling ? "a cancellation" : "an entry"} dated {e.entry?.date ? formatDate(e.entry.date) : "inside the closed period"}</>
                      : <>{LOCK_KIND[e.kind]}{e.lockDate ? ` up to ${formatDate(e.lockDate)}` : ": the books are open"}{e.previousLockDate && e.kind !== "closed" ? ` (was ${formatDate(e.previousLockDate)})` : ""}</>}
                  </td>
                  <td className="py-1.5 pr-3">{e.byName || (e.via === "before-history" ? "—" : "")}</td>
                  <td className="py-1.5 text-ink-600">{e.reason || (e.via === "tally-export" ? "Sent to Tally" : e.via === "before-history" ? "As it stood when the history began" : "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

