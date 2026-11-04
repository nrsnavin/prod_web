import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ClipboardCheck, HandCoins, Landmark, PhoneCall, Scale, Timer, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money } from "./shared";
import { OverviewTab } from "./OverviewTab";

function Box({ icon: I, title, count, amount, to, children, empty, badge }: {
  icon: typeof Landmark; title: string; count: number; amount?: number; to: string; children?: React.ReactNode; empty: string; badge?: React.ReactNode;
}) {
  return (
    // min-w-0: a long line inside must not widen the grid column past the screen.
    <Card className={`min-w-0 p-4 ${count ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={to} className="flex items-center gap-2 font-semibold hover:underline"><I className="h-4 w-4 shrink-0 text-brand-600" /> {title}</Link>
          {badge}
        </div>
        <span className="shrink-0 text-right">
          <span className={`block text-xl font-bold tabular-nums ${count ? "" : "text-ink-400"}`}>{count}</span>
          {amount ? <span className="whitespace-nowrap text-xs tabular-nums text-ink-500">₹{money(amount)}</span> : null}
        </span>
      </div>
      {count ? <div className="mt-2 text-sm">{children}</div> : <p className="mt-2 flex items-center gap-1 text-sm text-ink-400"><CheckCircle2 className="h-4 w-4 shrink-0" /> {empty}</p>}
    </Card>
  );
}

/** One line: a name, what it is underneath, the amount kept whole on the right. */
function Row({ name, meta, right, to }: { name: string; meta?: React.ReactNode; right: React.ReactNode; to?: string }) {
  return (
    <li className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {to ? <Link to={to} className="block truncate text-brand-600 hover:underline">{name}</Link> : <p className="truncate">{name}</p>}
        {meta && <p className="truncate text-xs text-ink-400">{meta}</p>}
      </div>
      <span className="shrink-0 whitespace-nowrap tabular-nums">{right}</span>
    </li>
  );
}

/** What needs someone today, before the figures. */
export function InboxTab() {
  const { data, isLoading } = useQuery({ queryKey: [ACCOUNTS_KEY, "inbox"], queryFn: accountsService.inbox });
  const bankTo = data?.bankLines.statement
    ? `/accounts/bank?view=past&account=${data.bankLines.account}&statement=${data.bankLines.statement}`
    : "/accounts/bank";
  return (
    <div className="space-y-6">
      {isLoading || !data ? <Skeleton className="h-48 w-full" /> : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Box icon={ClipboardCheck} title="Expenses to approve" count={data.approvals.count} amount={data.approvals.amount} to="/accounts/expenses" empty="Nothing waiting on you">
            <ul className="space-y-2">{data.approvals.top.map((e) => <Row key={e._id} to={`/accounts/expenses/${e._id}`} name={e.description} meta={`${e.categoryName}${e.submittedByName ? ` · ${e.submittedByName}` : ""} · ${formatDate(e.date)}`} right={`₹${money(e.totals.grand)}`} />)}</ul>
          </Box>
          <Box icon={CalendarClock} title="Bills due or overdue" count={data.billsDue.count} amount={data.billsDue.amount} to="/accounts/bills" empty="Nothing falls due this week"
            badge={data.billsDue.overdue ? <StatusChip tone="danger" className="mt-1">{data.billsDue.overdue} overdue</StatusChip> : null}>
            <ul className="space-y-2">{data.billsDue.top.map((b) => (
              <Row key={b.id} name={b.partyName} right={`₹${money(b.outstanding)}`}
                meta={<>{b.docNo} · {b.overdueDays > 0 ? <span className="text-status-danger">{b.overdueDays}d overdue</span> : `due ${formatDate(b.dueDate)}`}</>} />
            ))}</ul>
          </Box>
          <Box icon={PhoneCall} title="Customers to chase" count={data.toChase.count} amount={data.toChase.amount} to="/accounts/collections" empty="Nobody to chase today">
            <ul className="space-y-2">{data.toChase.top.map((c) => <Row key={c.party} name={c.partyName} meta={`${c.oldestDays} days overdue${c.next ? ` · ${c.next.label.toLowerCase()}` : ""}`} right={`₹${money(c.overdue)}`} />)}</ul>
            {data.promisesDue.count > 0 && <p className="mt-2 text-xs text-ink-500">{data.promisesDue.count} promised to pay by today: {data.promisesDue.top.map((p) => p.partyName).join(", ")}</p>}
          </Box>
          <Box icon={Landmark} title="Bank lines to place" count={data.bankLines.count} amount={data.bankLines.amount} to={bankTo} empty="Every statement line is in the books">
            <p className="text-ink-500">On the statement{data.bankLines.accountName ? ` for ${data.bankLines.accountName}` : ""}, not yet in the books — including lines with a suggested match nobody has posted.</p>
            <Link to={bankTo} className="mt-1 inline-block text-brand-600 hover:underline">Open the statement</Link>
          </Box>
          <Box icon={HandCoins} title="Claims to pay back" count={data.claimsToPay.count} amount={data.claimsToPay.amount} to="/accounts/expenses" empty="No approved claim is waiting">
            <ul className="space-y-2">{data.claimsToPay.top.map((e) => <Row key={e._id} to={`/accounts/expenses/${e._id}`} name={e.payeeName || e.description} meta={e.payeeName ? e.description : undefined} right={`₹${money(e.totals.grand - (e.paidAmount ?? 0))}`} />)}</ul>
          </Box>
          {data.msmeDue && (
            <Box icon={Timer} title="MSME bills: 45-day limit" count={data.msmeDue.count} amount={data.msmeDue.amount} to="/accounts/statutory" empty="Every micro and small supplier is within the limit"
              badge={data.msmeDue.overdue ? <StatusChip tone="danger" className="mt-1">{data.msmeDue.overdue} past the limit</StatusChip> : null}>
              <ul className="space-y-2">{data.msmeDue.top.map((b) => (
                <Row key={b.id} to={b.docType === "SupplierBill" ? `/accounts/bills/${b.id}` : `/accounts/expenses/${b.id}`} name={b.partyName} right={`₹${money(b.outstanding)}`}
                  meta={<>{b.docNo} · {b.daysLeft < 0 ? <span className="text-status-danger">{-b.daysLeft}d past the limit</span> : `pay by ${formatDate(b.dueDate)}`}</>} />
              ))}</ul>
            </Box>
          )}
          {data.serviceBills && (
            <Box icon={Wrench} title="Machine service bills to enter" count={data.serviceBills.count} amount={data.serviceBills.amount} to="/machines" empty="Every service bill is in the books">
              <ul className="space-y-2">{data.serviceBills.top.map((b) => <Row key={b._id} to={`/accounts/bills?serviceBill=${b._id}`} name={b.vendor || b.filename || "Service bill"} meta={`${b.kind === "spare_bill" ? "Spare" : "Service"}${b.billNo ? ` · #${b.billNo}` : ""} · ${formatDate(b.billDate || b.createdAt)}`} right={`₹${money(b.amount)}`} />)}</ul>
            </Box>
          )}
          <Box icon={Scale} title="Bills off their PO" count={data.variances.count} to="/accounts/bills" empty="Every recent bill matches its PO">
            <ul className="space-y-2">{data.variances.top.map((b) => <Row key={b._id} to={`/accounts/bills/${b._id}`} name={b.supplierName} meta={`${b.billNo} · ${formatDate(b.billDate)}`} right={<StatusChip tone="warning">₹{money(b.variance.total)}</StatusChip>} />)}</ul>
          </Box>
        </div>
      )}
      <OverviewTab inInbox />
    </div>
  );
}
