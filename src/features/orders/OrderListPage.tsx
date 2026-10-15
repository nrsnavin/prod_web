import { useMemo, useState } from "react";
import { usePrefillElastics } from "@/features/elastics/prefill";
import { useNavigate } from "react-router-dom";
import { Plus, FileUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { useOrders, useOrderMutations } from "./hooks";
import { ORDER_FILTERS, OrderFilter, OrderListItem } from "./types";
import { orderStatusTone, orderStatusLabel, orderFilterLabel } from "./orderStatus";
import { OrderForm } from "./OrderForm";
import { PoIntakeModal } from "./PoIntakeModal";
import { OrderBulkActions } from "./OrderBulkActions";
import { formatDate } from "@/core/format/date";

const columns: Column<OrderListItem>[] = [
  { key: "no", header: "Order #", render: (o) => <span className="font-medium">#{o.orderNo}</span> },
  { key: "customer", header: "Customer", render: (o) => o.customer?.name ?? "—" },
  { key: "po", header: "Customer PO", render: (o) => o.po || "—" },
  {
    key: "date",
    header: "Order date",
    render: (o) => (o.date ? formatDate(o.date) : "—"),
  },
  {
    key: "supply",
    header: "Supply by",
    render: (o) => (o.supplyDate ? formatDate(o.supplyDate) : "—"),
  },
  {
    key: "status",
    header: "Status",
    render: (o) => (
      <StatusChip tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</StatusChip>
    ),
  },
];

export function OrderListPage() {
  const [status, setStatus] = useState<OrderFilter>("All");
  const [createOpen, setCreateOpen] = useState(false);
  // Arrived from the elastic list with a selection: open New order with it.
  const { prefill, clear: clearPrefill } = usePrefillElastics(() => setCreateOpen(true));
  const closeCreate = () => { setCreateOpen(false); clearPrefill(); };
  const [intakeOpen, setIntakeOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    orders, total, isLoading, isError, error,
    hasNextPage, fetchNextPage, isFetchingNextPage,
  } = useOrders(status);
  const { create } = useOrderMutations();

  // Ticked orders, kept with their rows so a selection survives a change
  // of filter; the bar sees the latest copy of each row on screen.
  const [picked, setPicked] = useState<Map<string, OrderListItem>>(new Map());
  const pickedIds = useMemo(() => new Set(picked.keys()), [picked]);
  const onPick = (next: Set<string>) => {
    const shown = new Map(orders.map((o) => [o._id, o]));
    setPicked((prev) => {
      const m = new Map<string, OrderListItem>();
      for (const id of next) {
        const row = shown.get(id) ?? prev.get(id);
        if (row) m.set(id, row);
      }
      return m;
    });
  };
  const selectedRows = useMemo(() => {
    const shown = new Map(orders.map((o) => [o._id, o]));
    return [...picked.values()].map((o) => shown.get(o._id) ?? o);
  }, [picked, orders]);

  const scope = status === "All" ? "" : `${orderFilterLabel[status].toLowerCase()} `;

  return (
    <>
      <PageHeader
        title="Orders"
        // Honest about truncation: the endpoint is paged, so say how many
        // of the matching orders are actually on screen.
        subtitle={
          isLoading
            ? undefined
            : orders.length < total
              ? `${orders.length} of ${total} ${scope}orders`
              : `${total} ${scope}orders`
        }
        actions={
          <>
            {/* Secondary on purpose: typing the order is still the
                normal path, and reading a document is the shortcut. */}
            <Button variant="secondary" onClick={() => setIntakeOpen(true)}>
              <FileUp className="h-4 w-4" /> Read a customer PO
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New order
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <FilterChips
          options={ORDER_FILTERS.map((s) => ({ value: s, label: orderFilterLabel[s] }))}
          value={status}
          onChange={setStatus}
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      {picked.size > 0 && <OrderBulkActions selected={selectedRows} onClear={() => setPicked(new Map())} />}

      <Card>
        <DataTable
          selection={{ selected: pickedIds, onChange: onPick, label: (o) => `Select order ${o.orderNo}` }}
          columns={columns}
          rows={orders}
          rowKey={(o) => o._id}
          onRowClick={(o) => navigate(`/orders/${o._id}`)}
          loading={isLoading}
          emptyTitle={`No ${scope}orders`}
        />
        {hasNextPage && (
          <div className="border-t border-ink-100 p-3 text-center">
            <Button
              variant="secondary"
              loading={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              Load more ({total - orders.length} remaining)
            </Button>
          </div>
        )}
      </Card>

      {intakeOpen && <PoIntakeModal onClose={() => setIntakeOpen(false)} />}

      <FormScreen open={createOpen} onClose={closeCreate} title="New order" width="max-w-2xl">
        <OrderForm
          prefillElastics={prefill}
          submitting={create.isPending}
          onCancel={() => closeCreate()}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: (orderId) => {
                closeCreate();
                toast("Order created", "success");
                navigate(`/orders/${orderId}`);
              },
              onError: (e) =>
                toast(e instanceof ApiError ? e.message : "Failed to create order", "error"),
            })
          }
        />
      </FormScreen>
    </>
  );
}
