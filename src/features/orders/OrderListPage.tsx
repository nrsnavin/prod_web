import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useOrders, useOrderMutations } from "./hooks";
import { ORDER_STATUSES, OrderListItem, OrderStatus } from "./types";
import { orderStatusTone, orderStatusLabel } from "./orderStatus";
import { OrderForm } from "./OrderForm";

const columns: Column<OrderListItem>[] = [
  { key: "no", header: "Order #", render: (o) => <span className="font-medium">#{o.orderNo}</span> },
  { key: "customer", header: "Customer", render: (o) => o.customer?.name ?? "—" },
  { key: "po", header: "Customer PO", render: (o) => o.po || "—" },
  {
    key: "date",
    header: "Order date",
    render: (o) => (o.date ? new Date(o.date).toLocaleDateString() : "—"),
  },
  {
    key: "supply",
    header: "Supply by",
    render: (o) => (o.supplyDate ? new Date(o.supplyDate).toLocaleDateString() : "—"),
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
  const [status, setStatus] = useState<OrderStatus>("Open");
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useOrders(status);
  const { create } = useOrderMutations();

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={data ? `${data.length} ${orderStatusLabel[status].toLowerCase()} orders` : undefined}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New order
          </Button>
        }
      />

      <div className="mb-4">
        <FilterChips
          options={ORDER_STATUSES.map((s) => ({ value: s, label: orderStatusLabel[s] }))}
          value={status}
          onChange={setStatus}
        />
      </div>

      {isError && (
        <p className="mb-4 rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
          {(error as Error).message}
        </p>
      )}

      <Card>
        <DataTable
          columns={columns}
          rows={data ?? []}
          rowKey={(o) => o._id}
          onRowClick={(o) => navigate(`/orders/${o._id}`)}
          loading={isLoading}
          emptyTitle={`No ${orderStatusLabel[status].toLowerCase()} orders`}
        />
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New order" width="max-w-2xl">
        <OrderForm
          submitting={create.isPending}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: (orderId) => {
                setCreateOpen(false);
                toast("Order created", "success");
                navigate(`/orders/${orderId}`);
              },
              onError: (e) =>
                toast(e instanceof ApiError ? e.message : "Failed to create order", "error"),
            })
          }
        />
      </Modal>
    </>
  );
}
