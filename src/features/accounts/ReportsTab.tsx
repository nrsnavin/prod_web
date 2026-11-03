import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FilterChips } from "@/components/ui/FilterChips";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY, useBankAccounts } from "./hooks";
import { RangePicker, defaultPeriod, money, today } from "./shared";
import type { GstRateRow } from "./types";

type Report = "gst" | "tds" | "expenses" | "cashbook" | "daybook";

function RateTable({ title, rows, inter }: { title: string; rows: GstRateRow[]; inter?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</p>
      {rows.length === 0 ? <p className="text-sm text-ink-400">None.</p> : (
        <table className="mt-1 w-full text-sm">
          <thead><tr className="text-xs text-ink-400"><th className="text-left font-medium">Rate</th><th className="text-right font-medium">Taxable</th><th className="text-right font-medium">CGST</th><th className="text-right font-medium">SGST</th><th className="text-right font-medium">IGST</th><th className="text-right font-medium">Tax</th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => <tr key={r.rate}><td className="py-1">{r.rate}%</td><td className="py-1 text-right tabular-nums">{money(r.taxable)}</td><td className="py-1 text-right tabular-nums">{money(r.cgst)}</td><td className="py-1 text-right tabular-nums">{money(r.sgst)}</td><td className="py-1 text-right tabular-nums">{money(r.igst)}</td><td className="py-1 text-right tabular-nums font-medium">{money(r.tax)}</td></tr>)}
          </tbody>
        </table>
      )}
      {inter}
    </div>
  );
}

export function ReportsTab() {
  const [report, setReport] = useState<Report>("gst");
  const [range, setRange] = useState(defaultPeriod);
  const [account, setAccount] = useState("");
  const [day, setDay] = useState(today());
  const { data: accounts } = useBankAccounts();
  const acct = account || accounts?.[0]?._id || "";

  const gst = useQuery({ queryKey: [ACCOUNTS_KEY, "report-gst", range], queryFn: () => accountsService.gst(range), enabled: report === "gst" });
  const tds = useQuery({ queryKey: [ACCOUNTS_KEY, "report-tds", range], queryFn: () => accountsService.tds(range), enabled: report === "tds" });
  const exp = useQuery({ queryKey: [ACCOUNTS_KEY, "report-expenses", range], queryFn: () => accountsService.expenseReport(range), enabled: report === "expenses" });
  const book = useQuery({ queryKey: [ACCOUNTS_KEY, "report-cashbook", acct, range], queryFn: () => accountsService.cashbook(acct, range), enabled: report === "cashbook" && !!acct });
  const daybook = useQuery({ queryKey: [ACCOUNTS_KEY, "report-daybook", day], queryFn: () => accountsService.daybook(day), enabled: report === "daybook" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterChips options={[{ value: "gst", label: "GST" }, { value: "tds", label: "TDS register" }, { value: "expenses", label: "Expenses by head" }, { value: "cashbook", label: "Cash / bank book" }, { value: "daybook", label: "Day book" }]} value={report} onChange={setReport} />
        {report === "daybook" ? <Input label="Day" type="date" value={day} onChange={(e) => setDay(e.target.value)} /> : <RangePicker from={range.from} to={range.to} onChange={setRange} />}
        {report === "cashbook" && <Select label="Account" value={acct} onChange={(e) => setAccount(e.target.value)} options={(accounts ?? []).map((a) => ({ value: a._id, label: a.name }))} />}
      </div>

      {report === "gst" && (gst.isLoading ? <Skeleton className="h-64 w-full" /> : gst.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-4 p-5">
            <h3 className="font-semibold">Output tax (what we charged)</h3>
            <RateTable title={`Sales · ${gst.data.counts.invoices} invoices`} rows={gst.data.output.sales} />
            <RateTable title={`Less credit notes · ${gst.data.counts.creditNotes}`} rows={gst.data.output.creditNotes} />
          </Card>
          <Card className="space-y-4 p-5">
            <h3 className="font-semibold">Input credit (what we can claim)</h3>
            <RateTable title={`Purchases · ${gst.data.counts.bills} bills`} rows={gst.data.input.purchases} />
            <RateTable title={`Less debit notes · ${gst.data.counts.debitNotes}`} rows={gst.data.input.debitNotes} />
            <RateTable title={`Expenses with credit · ${gst.data.counts.expenses}`} rows={gst.data.input.expenses} />
          </Card>
          <Card className="p-5 lg:col-span-2">
            <h3 className="font-semibold">Net position</h3>
            <table className="mt-2 w-full max-w-xl text-sm">
              <thead><tr className="text-xs text-ink-400"><th className="text-left font-medium" /><th className="text-right font-medium">CGST</th><th className="text-right font-medium">SGST</th><th className="text-right font-medium">IGST</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                <tr><td className="py-1">Output tax, net of credit notes</td><td className="py-1 text-right tabular-nums">{money(gst.data.totals.netOutput.cgst)}</td><td className="py-1 text-right tabular-nums">{money(gst.data.totals.netOutput.sgst)}</td><td className="py-1 text-right tabular-nums">{money(gst.data.totals.netOutput.igst)}</td></tr>
                <tr><td className="py-1">Input credit, net of debit notes</td><td className="py-1 text-right tabular-nums">{money(gst.data.totals.netInput.cgst)}</td><td className="py-1 text-right tabular-nums">{money(gst.data.totals.netInput.sgst)}</td><td className="py-1 text-right tabular-nums">{money(gst.data.totals.netInput.igst)}</td></tr>
                <tr className="font-semibold"><td className="py-1">Payable (negative = credit carried)</td><td className="py-1 text-right tabular-nums">{money(gst.data.totals.payable.cgst)}</td><td className="py-1 text-right tabular-nums">{money(gst.data.totals.payable.sgst)}</td><td className="py-1 text-right tabular-nums">{money(gst.data.totals.payable.igst)}</td></tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-400">Figures as entered here; the return is filed from Tally.</p>
          </Card>
        </div>
      ))}

      {report === "tds" && (tds.isLoading ? <Skeleton className="h-64 w-full" /> : tds.data && (
        <Card className="p-5">
          <h3 className="font-semibold">TDS deducted</h3>
          <p className="text-sm text-ink-400">₹{money(tds.data.total.tds)} deducted on ₹{money(tds.data.total.base ?? tds.data.total.gross)} (value net of GST) of ₹{money(tds.data.total.gross)} settled</p>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400"><th className="py-2 text-left font-medium">Deductee</th><th className="py-2 text-left font-medium">Section</th><th className="py-2 text-right font-medium">Rate</th><th className="py-2 text-right font-medium">Settled</th><th className="py-2 text-right font-medium">TDS on</th><th className="py-2 text-right font-medium">TDS</th><th className="py-2 text-left font-medium">Vouchers</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {tds.data.rows.map((r, i) => (
                <tr key={i}><td className="py-2">{r.partyName}</td><td className="py-2">{r.section || "—"}</td><td className="py-2 text-right">{r.rate}%</td><td className="py-2 text-right tabular-nums">{money(r.gross)}</td><td className="py-2 text-right tabular-nums">{money(r.base ?? r.gross)}</td><td className="py-2 text-right tabular-nums font-medium">{money(r.tds)}</td>
                  <td className="py-2">{r.vouchers.map((v) => <Link key={v._id} to={`/accounts/payments/${v._id}`} className="mr-2 text-brand-600 hover:underline">{v.voucherNo}</Link>)}</td></tr>
              ))}
              {tds.data.rows.length === 0 && <tr><td className="py-4 text-ink-400" colSpan={7}>No TDS deducted in this period.</td></tr>}
            </tbody>
          </table>
        </Card>
      ))}

      {report === "expenses" && (exp.isLoading ? <Skeleton className="h-64 w-full" /> : exp.data && (
        <Card className="p-5">
          <h3 className="font-semibold">Expenses by head</h3>
          <p className="text-sm text-ink-400">₹{money(exp.data.total)} in all</p>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400"><th className="py-2 text-left font-medium">Head</th><th className="py-2 text-right font-medium">Entries</th><th className="py-2 text-right font-medium">Before tax</th><th className="py-2 text-right font-medium">Input credit</th><th className="py-2 text-right font-medium">Total</th><th className="py-2 text-right font-medium">Unpaid</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {exp.data.rows.map((r) => <tr key={r.category}><td className="py-2">{r.categoryName}</td><td className="py-2 text-right">{r.count}</td><td className="py-2 text-right tabular-nums">{money(r.taxable)}</td><td className="py-2 text-right tabular-nums">{money(r.itc)}</td><td className="py-2 text-right tabular-nums font-medium">{money(r.amount)}</td><td className={`py-2 text-right tabular-nums ${r.unpaid > 0 ? "text-status-warning" : ""}`}>{money(r.unpaid)}</td></tr>)}
              {exp.data.serviceBills.map((r, i) => <tr key={`sb-${i}`} className="text-ink-500"><td className="py-2">{r.categoryName} (service bills)</td><td className="py-2 text-right">{r.count}</td><td /><td /><td className="py-2 text-right tabular-nums">{money(r.amount)}</td><td /></tr>)}
              {exp.data.rows.length === 0 && <tr><td className="py-4 text-ink-400" colSpan={6}>No expenses in this period.</td></tr>}
            </tbody>
          </table>
        </Card>
      ))}

      {report === "cashbook" && (book.isLoading ? <Skeleton className="h-64 w-full" /> : book.data && (
        <Card className="p-5">
          <h3 className="font-semibold">{book.data.account.name}</h3>
          <p className="text-sm text-ink-400">Opening ₹{money(book.data.opening)} · in ₹{money(book.data.inflow)} · out ₹{money(book.data.outflow)} · closing <span className="font-semibold">₹{money(book.data.closing)}</span></p>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400"><th className="py-2 text-left font-medium">Date</th><th className="py-2 text-left font-medium">Voucher</th><th className="py-2 text-left font-medium">Party</th><th className="py-2 text-left font-medium">Ref</th><th className="py-2 text-right font-medium">In</th><th className="py-2 text-right font-medium">Out</th><th className="py-2 text-right font-medium">Balance</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {book.data.rows.map((r) => <tr key={r._id}><td className="py-2">{formatDate(r.date)}</td><td className="py-2">{r.docType === "Contra" ? <span className="font-medium">{r.voucherNo}</span> : <Link to={`/accounts/payments/${r._id}`} className="text-brand-600 hover:underline">{r.voucherNo}</Link>}</td><td className="py-2">{r.partyName}</td><td className="py-2 text-ink-500">{r.reference || r.narration || ""}</td><td className="py-2 text-right tabular-nums">{r.inflow ? money(r.inflow) : ""}</td><td className="py-2 text-right tabular-nums">{r.outflow ? money(r.outflow) : ""}</td><td className="py-2 text-right tabular-nums font-medium">{money(r.balance)}</td></tr>)}
              {book.data.rows.length === 0 && <tr><td className="py-4 text-ink-400" colSpan={7}>No movement in this period.</td></tr>}
            </tbody>
          </table>
        </Card>
      ))}

      {report === "daybook" && (daybook.isLoading ? <Skeleton className="h-64 w-full" /> : daybook.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5"><h3 className="font-semibold">Sales — ₹{money(daybook.data.totals.sales)}</h3><ul className="mt-2 divide-y divide-ink-100 text-sm">{daybook.data.invoices.map((i) => <li key={i._id} className="flex justify-between py-1.5"><Link to={`/invoices/${i._id}`} className="text-brand-600 hover:underline">{i.invoiceNumber}</Link><span>{i.buyer?.name}</span><span className="tabular-nums">{money(i.totals?.grand)}</span></li>)}{daybook.data.invoices.length === 0 && <li className="py-1.5 text-ink-400">None</li>}</ul></Card>
          <Card className="p-5"><h3 className="font-semibold">Purchases — ₹{money(daybook.data.totals.purchases)}</h3><ul className="mt-2 divide-y divide-ink-100 text-sm">{daybook.data.bills.map((b) => <li key={b._id} className="flex justify-between py-1.5"><Link to={`/accounts/bills/${b._id}`} className="text-brand-600 hover:underline">{b.billNo}</Link><span>{b.supplierName}</span><span className="tabular-nums">{money(b.totals?.grand)}</span></li>)}{daybook.data.bills.length === 0 && <li className="py-1.5 text-ink-400">None</li>}</ul></Card>
          <Card className="p-5"><h3 className="font-semibold">Expenses — ₹{money(daybook.data.totals.expenses)}</h3><ul className="mt-2 divide-y divide-ink-100 text-sm">{daybook.data.expenses.map((e) => <li key={e._id} className="flex justify-between py-1.5"><Link to={`/accounts/expenses/${e._id}`} className="text-brand-600 hover:underline">{e.expenseNo}</Link><span className="truncate px-2">{e.categoryName}: {e.description}</span><span className="tabular-nums">{money(e.totals?.grand)}</span></li>)}{daybook.data.expenses.length === 0 && <li className="py-1.5 text-ink-400">None</li>}</ul></Card>
          <Card className="p-5"><h3 className="font-semibold">Received ₹{money(daybook.data.totals.received)} · Paid ₹{money(daybook.data.totals.paid)}</h3><ul className="mt-2 divide-y divide-ink-100 text-sm">{daybook.data.payments.map((p) => <li key={p._id} className="flex justify-between py-1.5"><Link to={`/accounts/payments/${p._id}`} className="text-brand-600 hover:underline">{p.voucherNo}</Link><span className="truncate px-2">{p.partyName} · {p.accountName}</span><span className={`tabular-nums ${p.kind === "receipt" ? "text-status-success" : ""}`}>{p.kind === "receipt" ? "+" : "−"}{money(p.amount)}</span></li>)}{daybook.data.payments.length === 0 && <li className="py-1.5 text-ink-400">None</li>}</ul>
            {daybook.data.notes.length > 0 && <ul className="mt-2 divide-y divide-ink-100 text-sm">{daybook.data.notes.map((n) => <li key={n._id} className="flex justify-between py-1.5"><Link to={`/accounts/notes/${n._id}`} className="text-brand-600 hover:underline">{n.noteNo}</Link><span className="truncate px-2">{n.partyName} · {n.reason}</span><span className="tabular-nums">{money(n.totals?.grand)}</span></li>)}</ul>}
          </Card>
        </div>
      ))}
    </div>
  );
}
