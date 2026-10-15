import { useMemo, useState } from "react";
import { usePrefillElastics } from "@/features/elastics/prefill";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { useDcs, useDcMutations } from "./hooks";
import { DcFormValues, DcStatus, DcType, DeliveryChallan } from "./types";
import { DcForm } from "./DcForm";
import { StockShortDialog, stockShortFrom } from "./StockShortDialog";
import { DcBulkActions } from "./DcBulkActions";
import { formatDate } from "@/core/format/date";

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
    render: (d) => d.totalQuantity?.toLocaleString("en-IN") ?? "—",
  },
  {
    key: "amount",
    header: "Amount (₹)",
    align: "right",
    render: (d) => d.totalAmount?.toLocaleString("en-IN") ?? "—",
  },
  {
    key: "dispatch",
    header: "Dispatch",
    render: (d) => (d.dispatchDate ? formatDate(d.dispatchDate) : "—"),
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
  // Arrived from the elastic list with a selection: open New DC with it.
  const { prefill, clear: clearPrefill } = usePrefillElastics(() => setCreateOpen(true));
  const closeCreate = () => { setCreateOpen(false); clearPrefill(); };
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useDcs({ page, type, status, search });
  const { create } = useDcMutations();

  // Ticked challans, kept with their rows so a selection survives paging
  // and filtering. Status changes refetch the list; the rows here are
  // refreshed from it as they come back on screen.
  const [picked, setPicked] = useState<Map<string, DeliveryChallan>>(new Map());
  const pickedIds = useMemo(() => new Set(picked.keys()), [picked]);
  const onPick = (next: Set<string>) => {
    const onPage = new Map((data?.dcs ?? []).map((d) => [d._id, d]));
    setPicked((prev) => {
      const m = new Map<string, DeliveryChallan>();
      for (const id of next) {
        const row = onPage.get(id) ?? prev.get(id);
        if (row) m.set(id, row);
      }
      return m;
    });
  };
  // What the bar sees: the latest copy of each ticked row that is on screen.
  const selectedRows = useMemo(() => {
    const onPage = new Map((data?.dcs ?? []).map((d) => [d._id, d]));
    return [...picked.values()].map((d) => onPage.get(d._id) ?? d);
  }, [picked, data]);
  // A challan refused for shipping more than is in stock, held while the
  // user says why; confirming resends the same values with the reason.
  const [stockShort, setStockShort] = useState<{
    values: DcFormValues;
    short: NonNullable<ReturnType<typeof stockShortFrom>>;
  } | null>(null);

  const submit = (values: DcFormValues) =>
    create.mutate(values, {
      onSuccess: (dc) => {
        setStockShort(null);
        closeCreate();
        toast(`DC ${dc.dcNumber} created`, "success");
        navigate(`/delivery-challans/${dc._id}`);
      },
      onError: (e) => {
        const short = stockShortFrom(e);
        if (short && !values.stockShortfallReason) {
          setStockShort({ values, short });
          return;
        }
        setStockShort(null);
        toast(e instanceof ApiError ? e.message : "Failed to create DC", "error");
      },
    });

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

      {isError && <ErrorBanner message={(error as Error).message} />}

      {picked.size > 0 && <DcBulkActions selected={selectedRows} onClear={() => setPicked(new Map())} />}

      <Card>
        <DataTable
          selection={{ selected: pickedIds, onChange: onPick, label: (d) => `Select ${d.dcNumber}` }}
          columns={columns}
          rows={data?.dcs ?? []}
          rowKey={(d) => d._id}
          onRowClick={(d) => navigate(`/delivery-challans/${d._id}`)}
          loading={isLoading}
          emptyTitle="No delivery challans"
        />
        <Pagination page={page} totalPages={totalPages} total={data?.total} onChange={setPage} />
      </Card>

      <FormScreen open={createOpen} onClose={closeCreate} title="New delivery challan" width="max-w-3xl">
        <DcForm
          prefillElastics={prefill}
          submitting={create.isPending}
          onCancel={() => closeCreate()}
          onSubmit={(values) => submit(values)}
        />
      </FormScreen>

      <StockShortDialog
        open={!!stockShort}
        short={stockShort?.short ?? null}
        loading={create.isPending}
        onClose={() => setStockShort(null)}
        onConfirm={(reason) =>
          stockShort && submit({ ...stockShort.values, stockShortfallReason: reason })
        }
      />
    </>
  );
}
