import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatDate } from "@/core/format/date";
import { portal, pdfUrl } from "../api";
import { m, orderName, PageTitle, PdfLink } from "../ui";

export function DispatchesPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["portal", "dispatches", page, 20], queryFn: () => portal.dispatches(page) });

  return (
    <>
      <PageTitle title="Dispatches" sub="Every delivery challan that has left the mill for you, newest first." />
      <Card className="overflow-hidden">
        {q.isLoading ? (
          <div className="p-5"><Skeleton className="h-40 w-full" /></div>
        ) : q.isError ? (
          <p className="p-5 text-sm text-ink-500">{(q.error as Error).message}</p>
        ) : !q.data?.dispatches.length ? (
          <div className="p-5"><EmptyState compact icon={<Truck />} title="Nothing dispatched yet" /></div>
        ) : (
          <ul className="divide-y divide-ink-100" aria-label="Dispatches">
            {q.data.dispatches.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4">
                <Link to={`/dispatches/${d.id}`} className="group min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink-900 group-hover:text-brand-600">{d.dcNumber}</span>
                    {d.status === "delivered" ? (
                      <StatusChip tone="success">{d.deliveredOn ? `Delivered ${formatDate(d.deliveredOn)}` : "Delivered"}</StatusChip>
                    ) : (
                      <StatusChip tone="info">On its way</StatusChip>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-500">
                    {formatDate(d.date)}
                    {d.order ? ` · ${orderName(d.order)}` : ""}
                    {d.order?.po ? ` · PO ${d.order.po}` : ""} · {m(d.quantity)}
                    {d.items.length ? ` · ${d.items.map((i) => i.name).join(", ")}` : ""}
                  </span>
                </Link>
                <PdfLink href={pdfUrl(`/dispatches/${d.id}/pdf`)} variant="inline">Challan</PdfLink>
              </li>
            ))}
          </ul>
        )}
        {q.data && q.data.pages > 1 && <Pagination page={page} totalPages={q.data.pages} total={q.data.total} onChange={setPage} />}
      </Card>
    </>
  );
}
