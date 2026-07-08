import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useDcs, useDcMutations } from "./hooks";
import { DcStatus, DcType, DeliveryChallan } from "./types";
import { DcForm } from "./DcForm";

export const dcStatusTone: Record<DcStatus, ChipTone> = {
  draft: "neutral",
  dispatched: "info",
  delivered: "success",
  cancelled: "neutral",
};

const columns: Column<DeliveryChallan>[] = [
  { key: "no", header: "DC number", render: (d) => <span className="font-medium">{d.dcNumber}</span> },
  { key: "customer", header: "Customer", render: (d) => d.customerName },
  { key: "order", header: "Order", render: (d) => (d.orderNo ? `#${d.orderNo}` : "—") },
  {
    key: "type",
    header: "Type",
    render: (d) => (
      <StatusChip tone="neutral">{d.type === "elastic" ? "Elastic" : "Machine part"}</StatusChip>
    ),
  },
  {
    key: "qty",
    header: "Qty",
    align: "right",
    render: (d) => d.totalQuantity?.toLocaleString() ?? "—",
  },
  {
    key: "amount",
    header: "Amount (₹)",
    align: "right",
    render: (d) => d.totalAmount?.toLocaleString() ?? "—",
  },
  {
    key: "dispatch",
    header: "Dispatch",
    render: (d) => (d.dispatchDate ? new Date(d.dispatchDate).toLocaleDateString() : "—"),
  },
  {
    key: "status",
    header: "Status",
    render: (d) => <StatusChip tone={dcStatusTone[d.status]}>{d.status}</StatusChip>,
  },
];

export function DcListPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState<DcType | "all">("all");
  const [status, setStatus] = useState<DcStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useDcs({ page, type, status, search });
  const { create } = useDcMutations();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  return (
    <>
      <PageHeader
        title="Delivery challans"
        subtitle={data ? `${data.total} DCs` : undefined}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New DC
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
          placeholder="DC number, customer or order no…"
          className="w-full max-w-xs"
        />
        <FilterChips
          options={[
            { value: "all", label: "All types" },
            { value: "elastic", label: "Elastic" },
            { value: "machine_part", label: "Machine part" },
          ]}
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
        />
        <FilterChips
          options={[
            { value: "all", label: "All statuses" },
            { value: "draft", label: "Draft" },
            { value: "dispatched", label: "Dispatched" },
            { value: "delivered", label: "Delivered" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
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
          rows={data?.dcs ?? []}
          rowKey={(d) => d._id}
          onRowClick={(d) => navigate(`/delivery-challans/${d._id}`)}
          loading={isLoading}
          emptyTitle="No delivery challans"
        />
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New delivery challan" width="max-w-3xl">
        <DcForm
          submitting={create.isPending}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: (dc) => {
                setCreateOpen(false);
                toast(`DC ${dc.dcNumber} created`, "success");
                navigate(`/delivery-challans/${dc._id}`);
              },
              onError: (e) =>
                toast(e instanceof ApiError ? e.message : "Failed to create DC", "error"),
            })
          }
        />
      </Modal>
    </>
  );
}
