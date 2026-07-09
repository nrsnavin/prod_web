import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip } from "@/components/ui/StatusChip";
import { useJobs } from "./hooks";
import { JOB_STATUSES, JobListItem, JobStatus } from "./types";
import { jobStatusTone } from "./jobStatus";

const columns: Column<JobListItem>[] = [
  {
    key: "no",
    header: "Job #",
    render: (j) => <span className="font-medium">J-{j.jobOrderNo}</span>,
  },
  { key: "customer", header: "Customer", render: (j) => j.customer?.name ?? "—" },
  { key: "machine", header: "Machine", render: (j) => j.machine?.ID ?? "—" },
  {
    key: "date",
    header: "Date",
    render: (j) => (j.date ? new Date(j.date).toLocaleDateString() : "—"),
  },
  {
    key: "status",
    header: "Status",
    render: (j) => <StatusChip tone={jobStatusTone[j.status]}>{j.status}</StatusChip>,
  },
];

export function JobListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useJobs({ page, status, search });

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
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by job number…"
          className="w-full max-w-xs"
        />
        <FilterChips
          options={[
            { value: "all", label: "All" },
            ...JOB_STATUSES.map((s) => ({ value: s, label: s })),
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
          rows={data?.jobs ?? []}
          rowKey={(j) => j._id}
          onRowClick={(j) => navigate(`/jobs/${j._id}`)}
          loading={isLoading}
          emptyTitle="No jobs found"
          emptyDescription="Jobs are created from an approved order's detail page."
        />
        <Pagination page={page} totalPages={data?.pagination.pages ?? 1} total={data?.pagination.total} onChange={setPage} />
      </Card>
    </>
  );
}
