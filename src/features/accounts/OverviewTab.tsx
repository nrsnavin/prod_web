import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatDate } from "@/core/format/date";
import { useOverview } from "./hooks";
import { money } from "./shared";
import type { PartyWithAhead } from "./types";
import { StatTile as UiStatTile } from "@/components/ui/StatTile";

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" | "success" }) {
  return <UiStatTile label={label} value={value} sub={sub} tone={tone === "danger" ? "danger" : tone === "success" ? "good" : "default"} />;
}

const monthLabel = (from: string) => new Date(from).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

/** One party: name, how old the oldest due is, the total, and anything paid ahead set beside it. */
function PartyRow({ p, partyType }: { p: PartyWithAhead; partyType: "customer" | "supplier" }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <Link to={`/accounts/statements?partyType=${partyType}&party=${p.party}`} className="block truncate text-brand-600 hover:underline">{p.partyName}</Link>
        {p.paidAhead ? <p className="text-xs text-ink-500">less ₹{money(p.paidAhead)} {partyType === "supplier" ? "we paid ahead" : "they paid ahead"} · net ₹{money(p.total - p.paidAhead)}</p> : null}
      </div>
      <span className="flex shrink-0 items-center gap-2">
        {p.oldestDays > 0 && <StatusChip tone={p.oldestDays > 60 ? "danger" : "warning"}>{p.oldestDays}d</StatusChip>}
        <span className="whitespace-nowrap tabular-nums font-medium">₹{money(p.total)}</span>
      </span>
    </li>
  );
}

/**
 * The figures. Inside the inbox, the approvals count is left out — the
 * inbox already shows it, with the expenses themselves.
 */
export function OverviewTab({ inInbox = false }: { inInbox?: boolean } = {}) {
  const { data, isLoading, isError, error } = useOverview();
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !data) return <ErrorBanner message={(error as Error | null)?.message ?? "Could not load the overview"} />;
  const monthName = data.month.current === false ? monthLabel(data.month.from) : "This month";

  return (
    <div className="space-y-4">
      <div className={`grid gap-4 sm:grid-cols-2 ${inInbox ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        <Stat label="Receivable" value={`₹${money(data.receivables.total)}`} sub={`${data.receivables.count} open invoices · ₹${money(data.receivables.overdue)} overdue${data.receivables.paidAhead ? ` · ₹${money(data.receivables.paidAhead)} paid ahead` : ""}`} tone={data.receivables.overdue > 0 ? "danger" : undefined} />
        <Stat label="Payable" value={`₹${money(data.payables.total)}`} sub={`${data.payables.count} open bills · ₹${money(data.payables.overdue)} overdue${data.payables.paidAhead ? ` · less ₹${money(data.payables.paidAhead)} we paid ahead` : ""}`} />
        {!inInbox && <Stat label="Expenses to approve" value={String(data.pendingExpenses)} sub={data.pendingExpenses ? "waiting for an approver" : "nothing waiting"} />}
        <Stat label={monthName} value={`₹${money(data.month.sales.amount)} sold`} sub={`₹${money(data.month.purchases.amount)} bought · ₹${money(data.month.expenses.amount)} spent`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="p-5">
          <h3 className="font-semibold">Cash &amp; bank</h3>
          <ul className="mt-2 divide-y divide-ink-100 text-sm">
            {data.accounts.map((a) => (
              <li key={a._id} className="flex justify-between py-2">
                <span>{a.name} <span className="text-xs text-ink-400">{a.kind}</span></span>
                <span className={`tabular-nums font-medium ${a.balance < 0 ? "text-status-danger" : ""}`}>₹{money(a.balance)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-400">Opening balance + receipts − payments ± transfers recorded here.</p>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold">Owed to us</h3>
          {data.receivables.top.length === 0 ? <p className="mt-2 text-sm text-ink-400">Nothing outstanding.</p> : (
            <ul className="mt-2 divide-y divide-ink-100 text-sm">
              {data.receivables.top.map((p) => <PartyRow key={p.party} p={p} partyType="customer" />)}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold">We owe</h3>
          {data.payables.top.length === 0 ? <p className="mt-2 text-sm text-ink-400">Nothing outstanding.</p> : (
            <ul className="mt-2 divide-y divide-ink-100 text-sm">
              {data.payables.top.map((p) => <PartyRow key={p.party} p={p} partyType="supplier" />)}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card className="p-5">
          <h3 className="font-semibold">GST {data.month.current === false ? `for ${monthLabel(data.month.from)}` : "this month"}</h3>
          <dl className="mt-2 text-sm">
            <div className="flex justify-between py-1"><dt className="text-ink-500">Output tax on sales</dt><dd className="tabular-nums">₹{money(data.month.sales.outputTax)}</dd></div>
            <div className="flex justify-between py-1"><dt className="text-ink-500">Input credit on purchases</dt><dd className="tabular-nums">₹{money(data.month.purchases.inputCredit)}</dd></div>
            <div className="flex justify-between border-t border-ink-200 py-1 font-semibold"><dt>Net, before expenses</dt><dd className="tabular-nums">₹{money(data.month.sales.outputTax - data.month.purchases.inputCredit)}</dd></div>
          </dl>
          <Link to="/accounts/reports" className="mt-2 inline-block text-sm text-brand-600 hover:underline">Full GST report</Link>
          <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-400">
            Ask the books in plain words on <Link to="/assistant" className="text-brand-600 hover:underline">Ask Jarvis</Link> — "what does Sunrise owe us", "what did we pay Sri Yarn last quarter", "expenses by head this month".
          </p>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold">Recent vouchers</h3>
          {data.recentPayments.length === 0 ? <p className="mt-2 text-sm text-ink-400">No receipts or payments yet.</p> : (
            <ul className="mt-2 divide-y divide-ink-100 text-sm">
              {data.recentPayments.map((p) => (
                <li key={p._id} className="flex items-start justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <Link to={`/accounts/payments/${p._id}`} className="font-medium text-brand-600 hover:underline">{p.voucherNo}</Link>
                    <span className="block truncate text-xs text-ink-400 sm:inline sm:text-sm">{" "}· {p.partyName} · {formatDate(p.date)}</span>
                  </span>
                  <span className={`shrink-0 whitespace-nowrap tabular-nums ${p.kind === "receipt" ? "text-status-success" : ""}`}>{p.kind === "receipt" ? "+" : "−"}₹{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
