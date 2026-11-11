import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { formatDate } from "@/core/format/date";
import { rupees, rupeesPrecise } from "@/core/format/money";
import { portal, pdfUrl, PortalError } from "../api";
import { InvoiceStateChip, PageTitle, PdfLink } from "../ui";
import { NotFoundPage } from "./NotFoundPage";

type Show = "open" | "all";
const SHOW: { value: Show; label: string }[] = [
  { value: "open", label: "Not yet paid" },
  { value: "all", label: "All" },
];

export function InvoicesPage() {
  const [show, setShow] = useState<Show>("open");
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["portal", "invoices", show, page], queryFn: () => portal.invoices(show, page) });

  if (q.isError && q.error instanceof PortalError && q.error.status === 403) return <NotFoundPage />;

  return (
    <>
      <PageTitle title="Invoices" sub="What has been billed, what has been paid, and what is still owed." />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatTile label="Owed" value={q.data ? rupees(q.data.totals.owed) : "—"} loading={q.isLoading} size="sm" />
        <StatTile
          label="Overdue"
          value={q.data ? rupees(q.data.totals.overdue) : "—"}
          tone={q.data && q.data.totals.overdue > 0 ? "warning" : "default"}
          loading={q.isLoading}
          size="sm"
        />
      </div>
      <FilterChips label="Show" options={SHOW} value={show} onChange={(v) => { setShow(v); setPage(1); }} />
      <Card className="mt-3 overflow-hidden">
        {q.isLoading ? (
          <div className="p-5"><Skeleton className="h-40 w-full" /></div>
        ) : q.isError ? (
          <p className="p-5 text-sm text-ink-500">{(q.error as Error).message}</p>
        ) : !q.data?.invoices.length ? (
          <div className="p-5">
            <EmptyState compact icon={<Receipt />} title={show === "open" ? "Nothing owed" : "No invoices yet"} />
          </div>
        ) : (
          <ul className="divide-y divide-ink-100" aria-label="Invoices">
            {q.data.invoices.map((inv) => (
              <li key={inv.id} className="grid gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                    {inv.invoiceNumber} <InvoiceStateChip inv={inv} />
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {formatDate(inv.invoiceDate)}
                    {inv.dueDate ? ` · due ${formatDate(inv.dueDate)}` : ""}
                    {inv.orderNo != null ? ` · Order #${inv.orderNo}` : ""}
                  </p>
                </div>
                <div className="text-sm tabular-nums sm:text-right">
                  <p className="font-medium text-ink-900">{rupeesPrecise(inv.total)}</p>
                  <p className="text-xs text-ink-500">
                    {inv.owed > 0 ? `${rupeesPrecise(inv.owed)} owed` : "Paid in full"}
                    {inv.paid > 0 && inv.owed > 0 ? ` · ${rupeesPrecise(inv.paid)} paid` : ""}
                  </p>
                </div>
                <PdfLink href={pdfUrl(`/invoices/${inv.id}/pdf`)} variant="inline">Invoice</PdfLink>
              </li>
            ))}
          </ul>
        )}
        {q.data && q.data.pages > 1 && <Pagination page={page} totalPages={q.data.pages} total={q.data.total} onChange={setPage} />}
      </Card>
    </>
  );
}
