import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { usePurchaseOrders } from "./hooks";
import { PoStatus, PurchaseOrder } from "./types";

export const poStatusTone: Record<PoStatus, ChipTone> = {
  Open: "info",
  Partial: "warning",
  Completed: "success",
};

function supplierName(po: PurchaseOrder): string {
  return typeof po.supplier === "object" && po.supplier ? po.supplier.name : "—";
}

function poValue(po: PurchaseOrder): number {
  return po.items.reduce((s, it) => s + it.price * it.quantity, 0);
}

function receivedPct(po: PurchaseOrder): number {
  const ordered = po.items.reduce((s, it) => s + it.quantity, 0);
  const received = po.items.reduce((s, it) => s + (it.received ?? 0), 0);
  return ordered > 0 ? Math.round((received / ordered) * 100) : 0;
}

const columns: Column<PurchaseOrder>[] = [
  { key: "no", header: "PO #", render: (po) => <span className="font-medium">#{po.poNo}</span> },
  { key: "supplier", header: "Supplier", render: supplierName },
  { key: "items", header: "Items", align: "right", render: (po) => po.items.length },
  {
    key: "value",
    header: "Value (₹)",
    align: "right",
    render: (po) => poValue(po).toLocaleString("en-IN"),
  },
  {
    key: "received",
    header: "Received",
    align: "right",
    render: (po) => `${receivedPct(po)}%`,
  },
  {
    key: "status",
    header: "Status",
    render: (po) => <StatusChip tone={poStatusTone[po.status]}>{po.status}</StatusChip>,
  },
  {
    key: "date",
    header: "Created",
    render: (po) => (po.createdAt ? new Date(po.createdAt).toLocaleDateString() : "—"),
  },
];

export function PoListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PoStatus | "all">("all");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = usePurchaseOrders({ page, status, search });

  return (
    <>
      <PageHeader
        title="Purchase orders"
        subtitle={data ? `${data.pagination.total} POs` : undefined}
        actions={
          <Button onClick={() => navigate("/purchase-orders/new")}>
            <Plus className="h-4 w-4" /> New PO
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by PO number…"
          className="w-full max-w-xs"
        />
        <FilterChips
          options={[
            { value: "all", label: "All" },
            { value: "Open", label: "Open" },
            { value: "Partial", label: "Partial" },
            { value: "Completed", label: "Completed" },
          ]}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      <Card>
        <DataTable
          columns={columns}
          rows={data?.pos ?? []}
          rowKey={(po) => po._id}
          onRowClick={(po) => navigate(`/purchase-orders/${po._id}`)}
          loading={isLoading}
          emptyTitle="No purchase orders"
          emptyDescription="Raise a PO to restock raw materials."
        />
        <Pagination page={page} totalPages={data?.pagination.totalPages ?? 1} total={data?.pagination.total} onChange={setPage} />
      </Card>
    </>
  );
}
