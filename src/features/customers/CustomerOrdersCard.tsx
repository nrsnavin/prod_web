import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ShoppingBag, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { orderStatusTone, orderStatusLabel } from "@/features/orders/orderStatus";
import { OrderStatus } from "@/features/orders/types";
import { customerService, CustomerOrderRow } from "./api";

function OrderRow({ o }: { o: CustomerOrderRow }) {
  return (
    <Link
      to={`/orders/${o._id}`}
      className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-ink-100/50"
    >
      <div className="min-w-0">
        <p className="font-medium text-sm">
          #{o.orderNo}
          {o.po ? <span className="text-ink-400"> · PO {o.po}</span> : null}
        </p>
        <p className="text-xs text-ink-400">
          {o.supplyDate ? `Supply ${new Date(o.supplyDate).toLocaleDateString()}` : ""}
          {o.createdAt ? ` · Created ${new Date(o.createdAt).toLocaleDateString()}` : ""}
        </p>
      </div>
      <span className="flex items-center gap-2 shrink-0">
        <StatusChip tone={orderStatusTone[o.status as OrderStatus] ?? "neutral"}>
          {orderStatusLabel[o.status as OrderStatus] ?? o.status}
        </StatusChip>
        <ChevronRight className="h-4 w-4 text-ink-400" />
      </span>
    </Link>
  );
}

// Recent orders for a customer — running (open/approved/in-progress) plus
// the latest completed/cancelled — each linking to the order detail page.
export function CustomerOrdersCard({ customerId }: { customerId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["customer-orders", customerId],
    queryFn: () => customerService.orders(customerId),
    retry: false,
  });

  return (
    <Card className="mt-4 p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <ShoppingBag className="h-4 w-4 text-brand-500" /> Orders
      </h3>

      {isLoading ? (
        <Skeleton className="mt-3 h-28 w-full" />
      ) : isError ? (
        <p className="mt-3 text-sm text-ink-400">Could not load orders.</p>
      ) : (data?.running.length ?? 0) === 0 && (data?.past.length ?? 0) === 0 ? (
        <p className="mt-3 text-sm text-ink-400">No orders for this customer yet.</p>
      ) : (
        <div className="mt-2">
          {(data?.running.length ?? 0) > 0 && (
            <>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                Running ({data!.running.length})
              </p>
              <div className="divide-y divide-ink-100">
                {data!.running.map((o) => (
                  <OrderRow key={o._id} o={o} />
                ))}
              </div>
            </>
          )}
          {(data?.past.length ?? 0) > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-400">
                Recent past ({data!.pastTotal})
              </p>
              <div className="divide-y divide-ink-100">
                {data!.past.map((o) => (
                  <OrderRow key={o._id} o={o} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
