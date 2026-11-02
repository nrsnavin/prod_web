import { useState } from "react";
import { Link } from "react-router-dom";
import { Receipt, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/cn";
import { canAccessPath } from "@/app/navigation";
import { useAuth } from "@/core/auth/useAuth";
import { formatDate } from "@/core/format/date";
import { useOrderInvoices } from "@/features/invoices/hooks";
import { money } from "@/features/invoices/gst";
import { einvoiceLabel, einvoiceTone, invoiceStatusTone } from "@/features/invoices/invoiceStatus";
import { RaiseInvoiceDialog } from "@/features/invoices/RaiseInvoiceDialog";
import type { EinvoiceStatus } from "@/features/invoices/types";

/**
 * The tax invoices raised for this order, and the button that raises
 * the next one. Offered only while a despatched challan is not on an
 * invoice yet: with nothing to invoice there is nothing to raise.
 */
export function OrderInvoices({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const { data, isLoading } = useOrderInvoices(orderId);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const canRaise = canAccessPath("/invoices", user);

  if (isLoading) {
    return (
      <Card className="mt-4 p-5">
        <h3 className="font-semibold">Invoices</h3>
        <Skeleton className="mt-3 h-20 w-full" />
      </Card>
    );
  }
  if (!data) return null;

  // A reply without the card's fields (an older server) renders as empty
  // rather than taking the whole order page down with it.
  const invoices = data.invoices ?? [];
  const totals = data.totals ?? { count: 0, cancelled: 0, invoiced: 0, registered: 0 };
  const uninvoicedDcs = data.uninvoicedDcs ?? [];

  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-center gap-2 px-5 pt-5">
        <h3 className="font-semibold">Invoices</h3>
        {totals.count > 0 && (
          <StatusChip tone="info">
            {totals.count} invoice{totals.count === 1 ? "" : "s"}
          </StatusChip>
        )}
        {totals.cancelled > 0 && <StatusChip tone="danger">{totals.cancelled} cancelled</StatusChip>}
        {totals.registered > 0 && <StatusChip tone="success">{totals.registered} with IRN</StatusChip>}
        <span className="ml-auto flex items-center gap-3">
          {totals.invoiced > 0 && <span className="text-sm tabular-nums text-ink-600">₹{money(totals.invoiced)} invoiced</span>}
          {canRaise && uninvoicedDcs.length > 0 && (
            <Button size="sm" onClick={() => setRaiseOpen(true)}>
              <Plus className="h-4 w-4" /> Raise invoice
            </Button>
          )}
        </span>
      </div>
      {uninvoicedDcs.length > 0 && (
        <p className="mt-1 px-5 text-sm text-ink-400">
          Not invoiced yet: {uninvoicedDcs.map((d) => d.dcNumber).join(", ")}
        </p>
      )}

      {invoices.length === 0 ? (
        <div className="p-5">
          <EmptyState
            compact
            icon={<Receipt className="h-6 w-6" />}
            title="No invoice yet"
            description={
              uninvoicedDcs.length > 0
                ? "Despatched challans are waiting to be invoiced."
                : "An invoice can be raised once a challan has been despatched."
            }
          />
        </div>
      ) : (
        <div className="mt-4 divide-y divide-ink-100 border-t border-ink-200">
          {invoices.map((inv) => {
            const e = (inv.einvoice?.status ?? "pending") as EinvoiceStatus;
            return (
              <div key={inv._id} className={cn("px-5 py-3", inv.status === "cancelled" && "opacity-60")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <Link to={`/invoices/${inv._id}`} className="font-medium text-brand-600 hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                    <span className="ml-2 text-xs text-ink-400">{formatDate(inv.invoiceDate)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums">₹{money(inv.totals?.grand)}</span>
                    <StatusChip tone={einvoiceTone[e]}>{einvoiceLabel[e]}</StatusChip>
                    <StatusChip tone={invoiceStatusTone[inv.status]}>{inv.status}</StatusChip>
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-ink-400">
                  {inv.dcs.map((d) => d.dcNumber).join(", ")}
                  {inv.lines?.length ? ` · ${inv.lines.map((l) => `${l.name} ${l.quantity}${l.unit}`).join(" · ")}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {raiseOpen && <RaiseInvoiceDialog orderId={orderId} onClose={() => setRaiseOpen(false)} />}
    </Card>
  );
}
