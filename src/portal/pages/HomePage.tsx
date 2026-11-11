import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Package, Receipt, Truck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/core/format/date";
import { rupees } from "@/core/format/money";
import { portal } from "../api";
import { m, orderName, PageTitle, Progress, SectionTitle, StageChip } from "../ui";

export function HomePage() {
  const summary = useQuery({ queryKey: ["portal", "summary"], queryFn: portal.summary });
  const open = useQuery({ queryKey: ["portal", "orders", "open", 1], queryFn: () => portal.orders("open") });
  const recent = useQuery({ queryKey: ["portal", "dispatches", 1, 5], queryFn: () => portal.dispatches(1, 5) });
  const s = summary.data;

  return (
    <>
      <PageTitle title={s?.customer.name || "Welcome"} sub={s ? `Signed in as ${s.user.name}` : undefined} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Open orders"
          value={s?.orders.open ?? "—"}
          sub={s ? (s.orders.dueSoon ? `${s.orders.dueSoon} due within two weeks` : "None due within two weeks") : undefined}
          icon={Package}
          to="/orders"
          loading={summary.isLoading}
        />
        <StatTile
          label="Last dispatch"
          value={s?.lastDispatch?.dcNumber ?? "None yet"}
          sub={s?.lastDispatch ? formatDate(s.lastDispatch.date) : undefined}
          icon={Truck}
          to={s?.lastDispatch ? `/dispatches/${s.lastDispatch.id}` : "/dispatches"}
          loading={summary.isLoading}
          size="sm"
        />
        {s?.canSeeMoney !== false && (
          <StatTile
            label="Owed"
            value={s?.money ? rupees(s.money.owed) : "—"}
            sub={s?.money ? (s.money.overdue > 0 ? `${rupees(s.money.overdue)} overdue` : "Nothing overdue") : undefined}
            tone={s?.money && s.money.overdue > 0 ? "warning" : "default"}
            icon={Receipt}
            to="/invoices"
            loading={summary.isLoading}
          />
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle aside={<Link to="/orders" className="text-sm text-brand-600 hover:underline">All orders</Link>}>
            Open orders
          </SectionTitle>
          {open.isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : !open.data?.orders.length ? (
            <EmptyState compact title="No open orders" description="new orders show here once the mill has them" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {open.data.orders.slice(0, 5).map((o) => (
                <li key={o.id}>
                  <Link to={`/orders/${o.id}`} className="-mx-2 block rounded-lg px-2 py-3 hover:bg-ink-100/50">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink-900">{orderName(o)}</span>
                        <span className="block text-xs text-ink-500">
                          {o.po ? `PO ${o.po} · ` : ""}due {formatDate(o.supplyDate)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <StageChip stage={o.stage} />
                        <ChevronRight className="h-4 w-4 text-ink-400" aria-hidden />
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress done={o.dispatched} of={o.ordered} label={`${orderName(o)} dispatched`} />
                      <span className="shrink-0 text-xs tabular-nums text-ink-500">
                        {m(o.dispatched)} of {m(o.ordered)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle aside={<Link to="/dispatches" className="text-sm text-brand-600 hover:underline">All dispatches</Link>}>
            Recent dispatches
          </SectionTitle>
          {recent.isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : !recent.data?.dispatches.length ? (
            <EmptyState compact title="Nothing dispatched yet" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {recent.data.dispatches.map((d) => (
                <li key={d.id}>
                  <Link to={`/dispatches/${d.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-ink-100/50">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink-900">{d.dcNumber}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {formatDate(d.date)}
                        {d.order ? ` · ${orderName(d.order)}` : ""} · {m(d.quantity)}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
