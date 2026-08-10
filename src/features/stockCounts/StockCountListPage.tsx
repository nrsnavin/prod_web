import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/components/ui/cn";
import { useStockCounts } from "./hooks";
import { STATUS_LABEL, STATUS_TONE, StockCountStatus, StockCountSummary } from "./types";
import { OpenCountForm } from "./OpenCountForm";

const money = (v: number) =>
  `${v < 0 ? "−" : ""}₹${Math.abs(Math.round(v)).toLocaleString("en-IN")}`;

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const columns: Column<StockCountSummary>[] = [
  {
    key: "no",
    header: "Count",
    render: (c) => (
      <div>
        <p className="font-medium">#{c.countNo ?? "—"}</p>
        <p className="text-xs text-ink-400">{c.label || "Untitled"}</p>
      </div>
    ),
  },
  {
    key: "scope",
    header: "Scope",
    render: (c) =>
      c.scope?.kind === "category"
        ? `Category · ${c.scope.category}`
        : c.scope?.kind === "supplier"
          ? "One supplier"
          : c.scope?.kind === "materials"
            ? `${c.scope.materials?.length ?? 0} selected`
            : "Everything",
  },
  {
    key: "progress",
    header: "Counted",
    align: "right",
    sort: (c) => (c.lines ? c.counted / c.lines : 0),
    render: (c) => (
      <span className={cn(c.counted < c.lines && "text-ink-400")}>
        {c.counted} / {c.lines}
      </span>
    ),
  },
  {
    key: "frozen",
    header: "Opened",
    sort: (c) => new Date(c.frozenAt).getTime(),
    render: (c) => day(c.frozenAt),
  },
  {
    key: "net",
    header: "Net variance",
    align: "right",
    render: (c) =>
      // Only a posted count has a settled figure. Showing a running one
      // for an open count would invite people to read it as a result.
      c.netValue === null || c.netValue === undefined ? (
        <span className="text-ink-400">—</span>
      ) : (
        <span
          className={cn(
            "font-semibold",
            c.netValue < 0 && "text-status-danger",
            c.netValue > 0 && "text-status-success"
          )}
        >
          {money(c.netValue)}
        </span>
      ),
  },
  {
    key: "status",
    header: "Status",
    render: (c) => <StatusChip tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</StatusChip>,
  },
];

const FILTERS: Array<{ value: StockCountStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "counting", label: "Counting" },
  { value: "review", label: "Review" },
  { value: "posted", label: "Posted" },
  { value: "cancelled", label: "Cancelled" },
];

export function StockCountListPage() {
  const [status, setStatus] = useState<StockCountStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [openForm, setOpenForm] = useState(false);
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useStockCounts({ status, page });

  return (
    <>
      <PageHeader
        title="Stock Counts"
        subtitle="Count the racks, review the differences, post them together"
        actions={
          <Button onClick={() => setOpenForm(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New count
          </Button>
        }
      />

      {isError && <ErrorBanner message={(error as Error)?.message ?? "Could not load stock counts"} />}

      <FilterChips
        options={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
        value={status}
        onChange={(v) => {
          setStatus(v as StockCountStatus | "all");
          setPage(1);
        }}
      />

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={data?.counts ?? []}
          rowKey={(c) => c._id}
          onRowClick={(c) => navigate(`/stock-counts/${c._id}`)}
          loading={isLoading}
          emptyTitle="No stock counts yet"
          emptyDescription="A count snapshots what the system believes, then records what is actually on the racks."
        />
      </div>

      {data && data.total > data.limit && (
        <Pagination
          page={data.page}
          totalPages={Math.max(1, Math.ceil(data.total / data.limit))}
          total={data.total}
          pageSize={data.limit}
          onChange={setPage}
        />
      )}

      {(data?.counts?.length ?? 0) === 0 && !isLoading && (
        <div className="mt-6 flex items-center gap-3 rounded-lg bg-ink-100 px-4 py-3 text-sm text-ink-600">
          <ClipboardCheck className="h-5 w-5 shrink-0 text-ink-400" />
          <p>
            Counting does not stop production. The sheet records what the system believed when
            you opened it; anything received or issued while you count is applied on top, not
            overwritten.
          </p>
        </div>
      )}

      <OpenCountForm
        open={openForm}
        onClose={() => setOpenForm(false)}
        onOpened={(id) => {
          setOpenForm(false);
          navigate(`/stock-counts/${id}`);
        }}
      />
    </>
  );
}
