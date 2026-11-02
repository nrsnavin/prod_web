import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatDate } from "@/core/format/date";
import { useOutstanding, useStatement } from "./hooks";
import { PartyPicker, RangePicker, money } from "./shared";
import { CreditsCard } from "./Credits";
import type { LedgerRow } from "./types";

const docPath = (r: LedgerRow) =>
  r.docType === "Invoice" ? `/invoices/${r.doc}` : r.docType === "SupplierBill" ? `/accounts/bills/${r.doc}` : r.docType === "Expense" ? `/accounts/expenses/${r.doc}`
    : r.docType === "AccountNote" ? `/accounts/notes/${r.doc}` : r.docType === "OpeningBalance" ? "/accounts/opening" : `/accounts/payments/${r.doc}`;

/** A party's statement of account, and the ageing of everyone's outstanding. */
export function StatementsTab() {
  const [params, setParams] = useSearchParams();
  const partyType = (params.get("partyType") === "supplier" ? "supplier" : "customer") as "customer" | "supplier";
  const party = params.get("party") ?? "";
  const [range, setRange] = useState({ from: "", to: "" });
  const { data: st, isLoading } = useStatement(party ? partyType : undefined, party || undefined, { from: range.from || undefined, to: range.to || undefined });
  const { data: ageing } = useOutstanding(partyType === "customer" ? "receivable" : "payable");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterChips options={[{ value: "customer", label: "Customers" }, { value: "supplier", label: "Suppliers" }]} value={partyType} onChange={(v) => setParams({ partyType: v })} />
        <div className="w-full max-w-sm">
          <PartyPicker partyType={partyType} value={party} onChange={(id) => setParams({ partyType, party: id })} />
        </div>
        <RangePicker from={range.from} to={range.to} onChange={setRange} />
      </div>

      {party && <CreditsCard partyType={partyType} party={party} />}

      {party && (isLoading ? <Skeleton className="h-64 w-full" /> : st && (
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
            <div>
              <h3 className="font-semibold">{st.party.name}</h3>
              <p className="text-sm text-ink-400">{st.party.gstin ? `GSTIN ${st.party.gstin} · ` : ""}{partyType === "customer" ? "receivable" : "payable"} ₹{money(st.open.total)} across {st.open.count} open document{st.open.count === 1 ? "" : "s"}{st.open.overdue > 0 ? ` · ₹${money(st.open.overdue)} overdue` : ""}</p>
            </div>
            <p className="text-sm">Closing balance <span className="font-semibold tabular-nums">₹{money(st.closing)}</span></p>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-ink-200 text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-2 text-left font-medium">Date</th><th className="py-2 text-left font-medium">Document</th><th className="py-2 text-left font-medium">Narration</th>
                  <th className="py-2 text-right font-medium">Debit</th><th className="py-2 text-right font-medium">Credit</th><th className="px-5 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                <tr className="text-ink-500"><td className="px-5 py-2" colSpan={5}>Opening balance{range.from ? ` on ${formatDate(range.from)}` : ""}</td><td className="px-5 py-2 text-right tabular-nums">{money(st.opening)}</td></tr>
                {st.rows.map((r) => (
                  <tr key={r._id}>
                    <td className="px-5 py-2">{formatDate(r.date)}</td>
                    <td className="py-2"><Link to={docPath(r)} className="text-brand-600 hover:underline">{r.docNo}</Link></td>
                    <td className="py-2 text-ink-500">{r.narration}</td>
                    <td className="py-2 text-right tabular-nums">{r.debit ? money(r.debit) : ""}</td>
                    <td className="py-2 text-right tabular-nums">{r.credit ? money(r.credit) : ""}</td>
                    <td className="px-5 py-2 text-right tabular-nums font-medium">{money(r.balance)}</td>
                  </tr>
                ))}
                {st.rows.length === 0 && <tr><td className="px-5 py-4 text-ink-400" colSpan={6}>Nothing in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {ageing && (
        <Card className="p-5">
          <h3 className="font-semibold">{partyType === "customer" ? "Receivables" : "Payables"} by age</h3>
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
