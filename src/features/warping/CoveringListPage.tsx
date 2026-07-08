import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataTable, Column } from "@/components/ui/DataTable";
import { useCoverings } from "./hooks";
import { Covering, ProgrammeStatus } from "./types";
import { ProgrammeChip, elasticLineName } from "./programmeShared";

const columns: Column<Covering>[] = [
  {
    key: "job",
    header: "Job",
    render: (c) => (
      <div>
        <p className="font-medium">J-{c.job?.jobOrderNo ?? "—"}</p>
        <p className="text-xs text-ink-400">{c.job?.customer?.name ?? ""}</p>
      </div>
    ),
  },
  {
    key: "elastics",
    header: "Elastics",
    render: (c) =>
      (c.elasticPlanned ?? [])
        .map((l) => elasticLineName(l))
        .filter(Boolean)
        .join(", ") || "—",
  },
  {
    key: "date",
    header: "Date",
    render: (c) => (c.date ? new Date(c.date).toLocaleDateString() : "—"),
  },
  { key: "status", header: "Status", render: (c) => <ProgrammeChip status={c.status} /> },
];

export function CoveringListPage() {
  const [status, setStatus] = useState<ProgrammeStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useCoverings({ status, search, page });

  return (
    <>
      <PageHeader
        title="Covering"
        subtitle="Covering programmes are opened automatically when a job is created."
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
            { value: "open", label: "Open" },
            { value: "in_progress", label: "In progress" },
            { value: "completed", label: "Completed" },
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
          rows={data?.data ?? []}
          rowKey={(c) => c._id}
          onRowClick={(c) => navigate(`/covering/${c._id}`)}
          loading={isLoading}
          emptyTitle="No covering programmes"
        />
      </Card>
    </>
  );
}
