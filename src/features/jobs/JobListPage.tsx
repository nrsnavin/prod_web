import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip } from "@/components/ui/StatusChip";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SavedViews, type ListView } from "@/components/ui/SavedViews";
import { cn } from "@/components/ui/cn";
import { useUrlNumber, useUrlState } from "@/core/hooks/useUrlState";
import { useJobs } from "./hooks";
import { JOB_STATUSES, JobListItem, JobStatus } from "./types";
import { jobStatusTone } from "./jobStatus";
import { formatDate } from "@/core/format/date";

// ══════════════════════════════════════════════════════════════════
//  JOBS
//
//  Each row now says how far along the job is (metres made and packed
//  of metres planned), which order it serves and how long that order
//  has left. The stage filter, the search and the page live in the
//  address; the foot of the table totals the metres shown.
// ══════════════════════════════════════════════════════════════════

const DAY = 86_400_000;
const qty = (xs?: Array<{ quantity?: number }>) => (xs ?? []).reduce((s, x) => s + (x.quantity ?? 0), 0);
const m = (n: number) => Math.round(n).toLocaleString("en-IN");
const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const OPEN = new Set<JobStatus>(["preparatory", "weaving", "finishing", "checking", "packing"]);

const columns: Column<JobListItem>[] = [
  {
    key: "no",
    header: "Job",
    sort: (j) => j.jobOrderNo,
    render: (j) => <span className="font-medium">J-{j.jobOrderNo}</span>,
  },
  { key: "customer", header: "Customer", sort: (j) => j.customer?.name ?? "", render: (j) => j.customer?.name ?? "—" },
  {
    key: "order",
    header: "Order",
    sort: (j) => (j.order?.supplyDate ? new Date(j.order.supplyDate).getTime() : Number.MAX_SAFE_INTEGER),
    render: (j) => {
      if (!j.order) return "—";
      const d = j.order.supplyDate ? Math.round((dayOf(new Date(j.order.supplyDate)) - dayOf(new Date())) / DAY) : null;
      return (
        <span>
          #{j.order.orderNo}
          {d != null && OPEN.has(j.status) && (
            <span className={cn("block text-xs", d < 0 ? "font-medium text-status-danger" : d <= 3 ? "text-status-warning" : "text-ink-400")}>
              {d < 0 ? `${-d} day${d === -1 ? "" : "s"} late` : d === 0 ? "due today" : `due in ${d} day${d === 1 ? "" : "s"}`}
            </span>
          )}
        </span>
      );
    },
  },
  { key: "machine", header: "Machine", sort: (j) => j.machine?.ID ?? "", render: (j) => j.machine?.ID ?? "—" },
  {
    key: "progress",
    header: "Made / planned",
    align: "right",
    sort: (j) => { const p = qty(j.elastics); return p ? qty(j.producedElastic) / p : 0; },
    render: (j) => {
      const planned = qty(j.elastics);
      const made = qty(j.producedElastic);
      const packed = qty(j.packedElastic);
      const pct = planned ? Math.min(100, Math.round((made / planned) * 100)) : 0;
      return (
        <span className="inline-block min-w-[8.5rem]">
          {m(made)} / {m(planned)} m
          <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-ink-100" aria-hidden>
            <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </span>
          {packed > 0 && <span className="block text-xs text-ink-400">{m(packed)} m packed</span>}
        </span>
      );
    },
    total: (rows) => `${m(rows.reduce((s, j) => s + qty(j.producedElastic), 0))} / ${m(rows.reduce((s, j) => s + qty(j.elastics), 0))} m`,
  },
  {
    key: "status",
    header: "Status",
    render: (j) => <StatusChip tone={jobStatusTone[j.status]}>{j.status}</StatusChip>,
  },
  {
    key: "date",
    header: "Started",
    defaultHidden: true,
    sort: (j) => (j.date ? new Date(j.date).getTime() : 0),
    render: (j) => (j.date ? formatDate(j.date) : "—"),
  },
];

const VIEWS: ListView[] = [
  { name: "All jobs", params: {} },
  { name: "On the loom", params: { status: "weaving" } },
  { name: "Being packed", params: { status: "packing" } },
  { name: "Not started", params: { status: "preparatory" } },
];

export function JobListPage() {
  const [page, setPage] = useUrlNumber("page", 1);
  const [status, setStatus] = useUrlState<JobStatus | "all">("status", "all", ["all", ...JOB_STATUSES]);
  const [search, setSearch] = useUrlState<string>("q", "");
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useJobs({ page, status, search });
  const rows = data?.jobs ?? [];

  return (
    <>
      <PageHeader
        title="Job orders"
        subtitle={
          data
            ? `${data.pagination.total} jobs · create new jobs from an order's detail page`
            : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SavedViews tableId="jobs" views={VIEWS} keys={["status", "q"]} />
        <SearchInput
          value={search}
          onChange={(v) => setSearch(v, { page: null })}
          placeholder="Search by job number…"
          className="w-full max-w-xs"
        />
        <FilterChips
          options={[
            { value: "all", label: "All" },
            ...JOB_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
          value={status}
          onChange={(v) => setStatus(v, { page: null })}
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(j) => j._id}
          onRowClick={(j) => navigate(`/jobs/${j._id}`)}
          loading={isLoading}
          emptyTitle="No jobs found"
          emptyDescription="Jobs are created from an approved order's detail page."
          tableId="jobs"
          totalLabel={`${rows.length} job${rows.length === 1 ? "" : "s"} on this page`}
        />
        <Pagination page={page} totalPages={data?.pagination.pages ?? 1} total={data?.pagination.total} onChange={setPage} />
      </Card>
    </>
  );
}
