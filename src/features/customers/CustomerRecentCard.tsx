import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Truck, Receipt, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatDate } from "@/core/format/date";
import { dcStatusTone } from "@/features/deliveryChallans/DcListPage";
import { money } from "@/features/invoices/gst";
import { einvoiceLabel, einvoiceTone, invoiceStatusTone } from "@/features/invoices/invoiceStatus";
import type { DcStatus } from "@/features/deliveryChallans/types";
import type { EinvoiceStatus, InvoiceStatus } from "@/features/invoices/types";
import { customerService } from "./api";

/**
 * The customer's recent paperwork: the challans that went out on their
 * orders and the invoices raised, each linking to the document. The
 * orders themselves are the card above this one.
 */
export function CustomerRecentCard({ customerId }: { customerId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["customer-recent", customerId],
    queryFn: () => customerService.recent(customerId),
    retry: false,
  });

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Truck className="h-4 w-4 text-brand-500" /> Recent delivery challans
          {data && data.dcTotal > 0 && <span className="text-sm font-normal text-ink-400">({data.dcTotal})</span>}
        </h3>
        {isLoading ? (
          <Skeleton className="mt-3 h-24 w-full" />
        ) : isError ? (
          <p className="mt-3 text-sm text-ink-400">Could not load the challans.</p>
        ) : (data?.dcs.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-ink-400">Nothing despatched to this customer yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-ink-100">
            {data!.dcs.map((dc) => (
              <Link
                key={dc._id}
                to={`/delivery-challans/${dc._id}`}
                className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-ink-100/50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{dc.dcNumber}</p>
                  <p className="text-xs text-ink-400">
                    {formatDate(dc.dispatchDate)}
                    {dc.orderNo != null ? ` · Order #${dc.orderNo}` : ""}
                    {dc.totalQuantity != null ? ` · ${dc.totalQuantity.toLocaleString("en-IN")} m` : ""}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusChip tone={dcStatusTone[dc.status as DcStatus] ?? "neutral"}>{dc.status}</StatusChip>
                  <ChevronRight className="h-4 w-4 text-ink-400" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Receipt className="h-4 w-4 text-brand-500" /> Recent invoices
          {data && data.invoiceTotal > 0 && <span className="text-sm font-normal text-ink-400">({data.invoiceTotal})</span>}
        </h3>
        {data && data.invoiced.count > 0 && (
          <p className="mt-1 text-sm text-ink-400">
            ₹{money(data.invoiced.amount)} invoiced on {data.invoiced.count} issued invoice{data.invoiced.count === 1 ? "" : "s"}
          </p>
        )}
        {isLoading ? (
          <Skeleton className="mt-3 h-24 w-full" />
        ) : isError ? (
          <p className="mt-3 text-sm text-ink-400">Could not load the invoices.</p>
        ) : (data?.invoices.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-ink-400">No invoice raised for this customer yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-ink-100">
            {data!.invoices.map((inv) => {
              const e = (inv.einvoice?.status ?? "pending") as EinvoiceStatus;
              return (
                <Link
                  key={inv._id}
                  to={`/invoices/${inv._id}`}
                  className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-ink-100/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-ink-400">
                      {formatDate(inv.invoiceDate)}
                      {inv.orderNo != null ? ` · Order #${inv.orderNo}` : ""}
                      {` · ₹${money(inv.totals?.grand)}`}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatusChip tone={einvoiceTone[e]}>{einvoiceLabel[e]}</StatusChip>
                    <StatusChip tone={invoiceStatusTone[inv.status as InvoiceStatus] ?? "neutral"}>{inv.status}</StatusChip>
                    <ChevronRight className="h-4 w-4 text-ink-400" />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
