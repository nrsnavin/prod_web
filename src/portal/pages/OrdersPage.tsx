import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Package } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/core/format/date";
import { portal } from "../api";
import { m, orderName, PageTitle, Progress, StageChip } from "../ui";

type Show = "open" | "closed" | "all";
const SHOW: { value: Show; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Completed or cancelled" },
  { value: "all", label: "All" },
];

export function OrdersPage() {
  const [show, setShow] = useState<Show>("open");
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["portal", "orders", show, page], queryFn: () => portal.orders(show, page) });

  return (
    <>
      <PageTitle title="Orders" sub="What you ordered, how much has been woven and dispatched, and when it is due." />
      <FilterChips label="Show" options={SHOW} value={show} onChange={(v) => { setShow(v); setPage(1); }} />
      <Card className="mt-3 overflow-hidden">
        {q.isLoading ? (
          <div className="p-5"><Skeleton className="h-40 w-full" /></div>
        ) : q.isError ? (
          <p className="p-5 text-sm text-ink-500">{(q.error as Error).message}</p>
        ) : !q.data?.orders.length ? (
          <div className="p-5">
            <EmptyState compact icon={<Package />} title={show === "open" ? "No open orders" : "No orders here"} />
          </div>
        ) : (
          <ul className="divide-y divide-ink-100" aria-label="Orders">
            {q.data.orders.map((o) => (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className="block px-5 py-4 hover:bg-ink-100/40">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-900">{orderName(o)}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {o.po ? `PO ${o.po} · ` : ""}ordered {formatDate(o.date)} · due {formatDate(o.supplyDate)} · {o.lines} elastic
                        {o.lines === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="flex items-center gap-2">
                      <StageChip stage={o.stage} />
                      <ChevronRight className="h-4 w-4 text-ink-400" aria-hidden />
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
                    <Progress done={o.dispatched} of={o.ordered} label={`${orderName(o)} dispatched`} />
                    <span className="text-xs tabular-nums text-ink-500">
                      {m(o.dispatched)} of {m(o.ordered)} dispatched
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {q.data && q.data.pages > 1 && (
          <Pagination page={page} totalPages={q.data.pages} total={q.data.total} onChange={setPage} />
        )}
      </Card>
    </>
  );
}
