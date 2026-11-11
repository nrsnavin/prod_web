import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatDate } from "@/core/format/date";
import { quantity } from "@/core/format/money";
import { portal, pdfUrl } from "../api";
import { BackLink, Fact, m, orderName, PageTitle, PdfLink, SectionTitle } from "../ui";
import { NotFoundPage } from "./NotFoundPage";

export function DispatchPage() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: ["portal", "dispatch", id], queryFn: () => portal.dispatch(id) });

  if (q.isLoading) return <Skeleton className="h-72 w-full" />;
  if (q.isError) return <NotFoundPage what="dispatch" />;
  const d = q.data!;

  return (
    <>
      <BackLink to="/dispatches">Dispatches</BackLink>
      <PageTitle
        title={d.dcNumber}
        sub={`Dispatched ${formatDate(d.date)}`}
        aside={
          <>
            <PdfLink href={pdfUrl(`/dispatches/${d.id}/pdf`)}>Challan PDF</PdfLink>
            <Link
              to={`/dispatches/${d.id}/certificates`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100"
            >
              <BadgeCheck className="h-4 w-4" aria-hidden /> Test certificates
            </Link>
          </>
        }
      />
      <Card className="p-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Fact label="Status">
            {d.status === "delivered" ? (
              <StatusChip tone="success">{d.deliveredOn ? `Delivered ${formatDate(d.deliveredOn)}` : "Delivered"}</StatusChip>
            ) : (
              <StatusChip tone="info">On its way</StatusChip>
            )}
          </Fact>
          <Fact label="Against">
            {d.order ? <Link className="text-brand-600 underline-offset-2 hover:underline" to={`/orders/${d.order.id}`}>{orderName(d.order)}</Link> : "—"}
          </Fact>
          <Fact label="Your PO">{d.order?.po}</Fact>
          <Fact label="Vehicle">{d.vehicleNo}</Fact>
          <Fact label="Transporter">{d.transporter}</Fact>
          <Fact label="LR number">{d.lrNumber}</Fact>
          {d.receivedBy && <Fact label="Received by">{d.receivedBy}</Fact>}
        </dl>
      </Card>
      <Card className="mt-4 overflow-hidden">
        <div className="px-5 pt-5"><SectionTitle>What it carried</SectionTitle></div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-ink-100 bg-surface-muted text-left text-xs font-medium text-ink-500">
              <th className="px-5 py-2.5">Elastic</th>
              <th className="px-5 py-2.5 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {d.items.map((i, n) => (
              <tr key={`${i.elastic}-${n}`}>
                <td className="px-5 py-3 font-medium text-ink-900">{i.name}</td>
                <td className="px-5 py-3 text-right tabular-nums">{quantity(i.quantity, i.unit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-ink-200 font-semibold">
              <td className="px-5 py-3">Total</td>
              <td className="px-5 py-3 text-right tabular-nums">{m(d.quantity)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </>
  );
}
