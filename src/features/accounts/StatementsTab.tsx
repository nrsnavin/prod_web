import { Fragment, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, FileDown, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/core/format/date";
import { useLedgerSummary, useOutstanding, useStatement } from "./hooks";
import { PartyPicker, RangePicker, money, periods } from "./shared";
import { CreditsCard } from "./Credits";
import { ShareDialog } from "./Share";
import { accountsService } from "./api";
import type { LedgerRow, Side } from "./types";

const docPath = (r: LedgerRow) =>
  r.docType === "Invoice" ? `/invoices/${r.doc}` : r.docType === "SupplierBill" ? `/accounts/bills/${r.doc}` : r.docType === "Expense" ? `/accounts/expenses/${r.doc}`
    : r.docType === "AccountNote" ? `/accounts/notes/${r.doc}` : r.docType === "OpeningBalance" ? "/accounts/opening" : r.docType === "Journal" ? `/accounts/vouchers?journal=${r.source ?? ""}` : `/accounts/payments/${r.doc}`;

/** An amount with its side, the way a ledger prints a balance: 10,500.00 Dr. */
const withSide = (amount: number, side?: Side) => `${money(Math.abs(amount))}${side ? ` ${side}` : ""}`;
/** A balance in its own column: a Dr balance under Debit, a Cr one under Credit. */
const inColumn = (amount: number, side: Side | undefined, column: "Dr" | "Cr") => (side === column ? money(Math.abs(amount)) : "");

const th = "py-2 text-xs font-medium uppercase tracking-wide text-ink-400";
const num = "py-2 text-right tabular-nums";

/**
 * Customers' and suppliers' accounts, as Tally keeps them: the group
 * summary (Sundry Debtors / Sundry Creditors) for the period, and a
 * party's ledger account — To / By particulars, voucher type and number,
 * Debit, Credit, the running balance Dr or Cr, Current Total and the
 * closing balance — condensed, or detailed with each voucher's other
 * ledgers and the bills it settled.
 */
export function StatementsTab() {
  const [params, setParams] = useSearchParams();
  const partyType = (params.get("partyType") === "supplier" ? "supplier" : "customer") as "customer" | "supplier";
  const party = params.get("party") ?? "";
  const fy = periods().find((p) => p.key === "fy")!;
  const [range, setRange] = useState({ from: fy.from, to: fy.to });
  const [detailed, setDetailed] = useState(false);
  const q = { from: range.from || undefined, to: range.to || undefined };
  const { data: st, isLoading } = useStatement(party ? partyType : undefined, party || undefined, q);
  const { data: summary, isLoading: summaryLoading } = useLedgerSummary(partyType, q);
  const { data: ageing } = useOutstanding(partyType === "customer" ? "receivable" : "payable");
  const [sharing, setSharing] = useState(false);
  const group = partyType === "customer" ? "Sundry Debtors" : "Sundry Creditors";
  const period = `${range.from ? formatDate(range.from) : "From the start"} to ${range.to ? formatDate(range.to) : "today"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterChips options={[{ value: "customer", label: "Customers" }, { value: "supplier", label: "Suppliers" }]} value={partyType} onChange={(v) => setParams({ partyType: v })} />
        <div className="w-full max-w-sm">
          <PartyPicker partyType={partyType} value={party} onChange={(id) => setParams({ partyType, party: id })} />
        </div>
        <RangePicker from={range.from} to={range.to} onChange={setRange} />
      </div>

      {!party && (
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
            <div>
              <h3 className="font-semibold">{group}</h3>
              <p className="text-sm text-ink-400">Group summary · {period}</p>
            </div>
            <a href={accountsService.ledgerSummaryXlsxUrl(partyType, q)} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"><Download className="h-4 w-4" /> Excel</a>
          </div>
          {summaryLoading ? <Skeleton className="m-5 h-40" /> : summary && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm" aria-label={group}>
                <thead>
                  <tr className="border-y border-ink-200">
                    <th className={`${th} px-5 text-left`}>Particulars</th><th className={`${th} text-right`}>Opening</th><th className={`${th} text-right`}>Debit</th><th className={`${th} text-right`}>Credit</th><th className={`${th} px-5 text-right`}>Closing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {summary.rows.map((r) => (
                    <tr key={r.party}>
                      <td className="px-5 py-2"><button className="text-left text-brand-600 hover:underline" onClick={() => setParams({ partyType, party: r.party })}>{r.partyName}</button>{r.gstin && <span className="block text-xs text-ink-400">{r.gstin}</span>}</td>
                      <td className={num}>{Math.abs(r.opening) > 0.004 ? withSide(r.opening, r.openingSide) : ""}</td>
                      <td className={num}>{r.debit ? money(r.debit) : ""}</td>
                      <td className={num}>{r.credit ? money(r.credit) : ""}</td>
                      <td className={`${num} px-5 font-medium`}>{Math.abs(r.closing) > 0.004 ? withSide(r.closing, r.closingSide) : "—"}</td>
                    </tr>
                  ))}
                  {summary.rows.length === 0 && <tr><td className="px-5 py-4 text-ink-400" colSpan={5}>No entries for any {partyType} in this period.</td></tr>}
                </tbody>
                {summary.rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-ink-300 font-semibold">
                      <td className="px-5 py-2">Grand Total</td>
                      <td className={num}>{withSide(summary.totals.opening, summary.totals.openingSide)}</td>
                      <td className={num}>{money(summary.totals.debit)}</td>
                      <td className={num}>{money(summary.totals.credit)}</td>
                      <td className={`${num} px-5`}>{withSide(summary.totals.closing, summary.totals.closingSide)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </Card>
      )}

      {party && <CreditsCard partyType={partyType} party={party} />}

      {party && (isLoading ? <Skeleton className="h-64 w-full" /> : st && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
            <div>
              <button className="mb-1 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800" onClick={() => setParams({ partyType })}><ArrowLeft className="h-3 w-3" /> {group}</button>
              <h3 className="font-semibold">{st.party.name}</h3>
              <p className="text-sm text-ink-400">Ledger Account · {period}{st.party.gstin ? ` · GSTIN ${st.party.gstin}` : ""}</p>
              {st.open.count > 0 && <p className="text-sm text-ink-500">{partyType === "customer" ? "Receivable" : "Payable"} ₹{money(st.open.total)} across {st.open.count} open document{st.open.count === 1 ? "" : "s"}{st.open.overdue > 0 ? ` · ₹${money(st.open.overdue)} overdue` : ""}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FilterChips options={[{ value: "condensed", label: "Condensed" }, { value: "detailed", label: "Detailed" }]} value={detailed ? "detailed" : "condensed"} onChange={(v) => setDetailed(v === "detailed")} />
              <a href={accountsService.statementPdfUrl(partyType, party, q, detailed)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"><FileDown className="h-4 w-4" /> PDF</a>
              <a href={accountsService.statementXlsxUrl(partyType, party, q)} className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"><Download className="h-4 w-4" /> Excel</a>
              <Button size="sm" variant="secondary" onClick={() => setSharing(true)}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm" aria-label="Ledger account">
              <thead>
                <tr className="border-y border-ink-200">
                  <th className={`${th} px-5 text-left`}>Date</th><th className={`${th} text-left`}>Particulars</th><th className={`${th} text-left`}>Vch Type</th><th className={`${th} text-left`}>Vch No.</th>
                  <th className={`${th} text-right`}>Debit</th><th className={`${th} text-right`}>Credit</th><th className={`${th} px-5 text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-ink-100 font-medium">
                  <td className="px-5 py-2" /><td className="py-2" colSpan={3}>Opening Balance</td>
                  <td className={num}>{inColumn(st.opening, st.openingSide, "Dr")}</td>
                  <td className={num}>{inColumn(st.opening, st.openingSide, "Cr")}</td>
                  <td className={`${num} px-5`}>{withSide(st.opening, st.openingSide)}</td>
                </tr>
                {st.rows.map((r) => (
                  <Fragment key={r._id}>
                    <tr className={detailed ? "" : "border-b border-ink-100"}>
                      <td className="whitespace-nowrap px-5 py-2 align-top">{formatDate(r.date)}</td>
                      <td className="py-2 pr-3 align-top">
                        <span><span className="text-ink-400">{r.toBy ?? (r.debit ? "To" : "By")}</span> {r.particulars || r.narration}</span>
                        {r.partyRef && <span className="block text-xs text-ink-400">{r.partyRef}</span>}
                      </td>
                      <td className="py-2 pr-3 align-top text-ink-600">{r.vchType}</td>
                      <td className="py-2 pr-3 align-top"><Link to={docPath(r)} className="text-brand-600 hover:underline">{r.docNo}</Link></td>
                      <td className={`${num} align-top`}>{r.debit ? money(r.debit) : ""}</td>
                      <td className={`${num} align-top`}>{r.credit ? money(r.credit) : ""}</td>
                      <td className={`${num} px-5 align-top font-medium`}>{withSide(r.balance, r.balanceSide)}</td>
                    </tr>
                    {detailed && (
                      <tr className="border-b border-ink-100">
                        <td />
                        <td colSpan={3} className="pb-2 pr-3">
                          <dl className="space-y-0.5 border-l-2 border-ink-100 pl-3 text-xs text-ink-500">
                            {(r.lines ?? []).map((l, i) => <div key={`l${i}`} className="flex max-w-md justify-between gap-4"><dt>{l.ledger}</dt><dd className="tabular-nums">{money(l.amount)}</dd></div>)}
                            {(r.refs ?? []).map((b, i) => <div key={`r${i}`} className="flex max-w-md justify-between gap-4"><dt>{b.type} <span className="text-ink-700">{b.name}</span></dt><dd className="tabular-nums">{money(b.amount)}</dd></div>)}
                            {!(r.lines?.length || r.refs?.length) && r.narration && <div>{r.narration}</div>}
                          </dl>
                        </td>
                        <td colSpan={3} />
                      </tr>
                    )}
                  </Fragment>
                ))}
                {st.rows.length === 0 && <tr className="border-b border-ink-100"><td className="px-5 py-4 text-ink-400" colSpan={7}>No entries in this period.</td></tr>}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-300 font-semibold">
                  <td className="px-5 py-2" /><td className="py-2" colSpan={3}>Current Total</td>
                  <td className={num}>{money(st.totals?.debit ?? st.rows.reduce((t, r) => t + r.debit, 0))}</td>
                  <td className={num}>{money(st.totals?.credit ?? st.rows.reduce((t, r) => t + r.credit, 0))}</td>
                  <td className="px-5" />
                </tr>
                <tr className="font-semibold">
                  <td className="px-5 py-2" /><td className="py-2" colSpan={3}>Closing Balance</td>
                  <td className={num}>{inColumn(st.closing, st.closingSide, "Dr")}</td>
                  <td className={num}>{inColumn(st.closing, st.closingSide, "Cr")}</td>
                  <td className={`${num} px-5`}>{withSide(st.closing, st.closingSide)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ))}

      {sharing && party && <ShareDialog what={{ kind: "statement", partyType, party, from: range.from || undefined, to: range.to || undefined }} customer={partyType === "customer" ? party : undefined} onClose={() => setSharing(false)} />}

      {ageing && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">{partyType === "customer" ? "Receivables" : "Payables"} by age</h3>
            <a href={accountsService.exportUrl(partyType === "customer" ? "receivables" : "payables")} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"><Download className="h-4 w-4" /> Excel</a>
          </div>
          <p className="text-sm text-ink-400">₹{money(ageing.totals.total)} outstanding · ₹{money(ageing.totals.overdue)} past due</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400">
                  <th className="py-2 text-left font-medium">Party</th>
                  {ageing.buckets.map((b) => <th key={b.key} className="py-2 text-right font-medium">{b.label}</th>)}
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {ageing.byParty.map((p) => (
                  <tr key={p.party}>
                    <td className="py-2"><button className="text-brand-600 hover:underline" onClick={() => setParams({ partyType, party: p.party })}>{p.partyName}</button>{p.oldestDays > 60 && <StatusChip tone="danger" className="ml-2">{p.oldestDays}d</StatusChip>}</td>
                    {ageing.buckets.map((b) => <td key={b.key} className={`py-2 text-right tabular-nums ${b.key === "over90" && p.ageing.over90 > 0 ? "text-status-danger font-medium" : ""}`}>{p.ageing[b.key] ? money(p.ageing[b.key]) : ""}</td>)}
                    <td className="py-2 text-right tabular-nums font-semibold">{money(p.total)}</td>
                  </tr>
                ))}
                {ageing.byParty.length === 0 && <tr><td className="py-4 text-ink-400" colSpan={7}>Nothing outstanding.</td></tr>}
              </tbody>
              {ageing.byParty.length > 0 && (
                <tfoot><tr className="border-t border-ink-200 font-semibold"><td className="py-2">Total</td>{ageing.buckets.map((b) => <td key={b.key} className="py-2 text-right tabular-nums">{money(ageing.totals.ageing[b.key])}</td>)}<td className="py-2 text-right tabular-nums">{money(ageing.totals.total)}</td></tr></tfoot>
              )}
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
