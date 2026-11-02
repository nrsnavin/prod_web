import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ClipboardCheck, HandCoins, Landmark, PhoneCall, Scale } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money } from "./shared";
import { OverviewTab } from "./OverviewTab";

function Box({ icon: I, title, count, amount, to, children, empty }: {
  icon: typeof Landmark; title: string; count: number; amount?: number; to: string; children?: React.ReactNode; empty: string;
}) {
  return (
    <Card className={`p-4 ${count ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-2">
        <Link to={to} className="flex items-center gap-2 font-semibold hover:underline"><I className="h-4 w-4 text-brand-600" /> {title}</Link>
        <span className="text-right">
          <span className={`block text-xl font-bold tabular-nums ${count ? "" : "text-ink-400"}`}>{count}</span>
          {amount ? <span className="text-xs tabular-nums text-ink-500">₹{money(amount)}</span> : null}
        </span>
      </div>
      {count ? <div className="mt-2 text-sm">{children}</div> : <p className="mt-2 flex items-center gap-1 text-sm text-ink-400"><CheckCircle2 className="h-4 w-4" /> {empty}</p>}
    </Card>
  );
}

/** What needs someone today, before the figures. */
export function InboxTab() {
  const { data, isLoading } = useQuery({ queryKey: [ACCOUNTS_KEY, "inbox"], queryFn: accountsService.inbox });
  return (
    <div className="space-y-6">
      {isLoading || !data ? <Skeleton className="h-48 w-full" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Box icon={ClipboardCheck} title="Expenses to approve" count={data.approvals.count} amount={data.approvals.amount} to="/accounts/expenses" empty="Nothing waiting on you">
            <ul className="space-y-1">{data.approvals.top.map((e) => <li key={e._id} className="flex justify-between gap-2"><Link to={`/accounts/expenses/${e._id}`} className="truncate text-brand-600 hover:underline">{e.description}</Link><span className="shrink-0 tabular-nums">₹{money(e.totals.grand)}</span></li>)}</ul>
          </Box>
          <Box icon={CalendarClock} title="Bills due this week" count={data.billsDue.count} amount={data.billsDue.amount} to="/accounts/bills" empty="Nothing falls due this week">
            <ul className="space-y-1">{data.billsDue.top.map((b) => <li key={b.id} className="flex justify-between gap-2"><span className="truncate">{b.partyName} <span className="text-ink-400">· {b.docNo} · {formatDate(b.dueDate)}</span></span><span className="shrink-0 tabular-nums">₹{money(b.outstanding)}</span></li>)}</ul>
          </Box>
          <Box icon={PhoneCall} title="Customers to chase" count={data.toChase.count} amount={data.toChase.amount} to="/accounts/collections" empty="Nobody to chase today">
            <ul className="space-y-1">{data.toChase.top.map((c) => <li key={c.party} className="flex justify-between gap-2"><span className="truncate">{c.partyName} <span className="text-ink-400">· {c.oldestDays}d{c.next ? ` · ${c.next.label.toLowerCase()}` : ""}</span></span><span className="shrink-0 tabular-nums">₹{money(c.overdue)}</span></li>)}</ul>
            {data.promisesDue.count > 0 && <p className="mt-2 text-xs text-ink-500">{data.promisesDue.count} promised to pay by today: {data.promisesDue.top.map((p) => p.partyName).join(", ")}</p>}
          </Box>
          <Box icon={Landmark} title="Bank lines to place" count={data.bankLines.count} to="/accounts/bank" empty="Every statement line is in the books">
            <p className="text-ink-500">Statement lines not yet in the books. Place them, or set them aside.</p>
          </Box>
          <Box icon={HandCoins} title="Claims to pay back" count={data.claimsToPay.count} amount={data.claimsToPay.amount} to="/accounts/expenses" empty="No approved claim is waiting">
            <ul className="space-y-1">{data.claimsToPay.top.map((e) => <li key={e._id} className="flex justify-between gap-2"><Link to={`/accounts/expenses/${e._id}`} className="truncate text-brand-600 hover:underline">{e.payeeName} · {e.description}</Link><span className="shrink-0 tabular-nums">₹{money(e.totals.grand - (e.paidAmount ?? 0))}</span></li>)}</ul>
          </Box>
          <Box icon={Scale} title="Bills off their PO" count={data.variances.count} to="/accounts/bills" empty="Every recent bill matches its PO">
            <ul className="space-y-1">{data.variances.top.map((b) => <li key={b._id} className="flex justify-between gap-2"><Link to={`/accounts/bills/${b._id}`} className="truncate text-brand-600 hover:underline">{b.billNo} · {b.supplierName}</Link><StatusChip tone="warning">₹{money(b.variance.total)}</StatusChip></li>)}</ul>
          </Box>
        </div>
      )}
      <OverviewTab />
    </div>
  );
}
