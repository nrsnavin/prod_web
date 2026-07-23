import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useWarpings } from "./hooks";
import { ProgrammeStatus, Warping } from "./types";
import { ProgrammeChip, elasticNames } from "./programmeShared";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const columns: Column<Warping>[] = [
  {
    key: "job",
    header: "Job",
    render: (w) => (
      <div>
        <p className="font-medium">J-{w.job?.jobOrderNo ?? "—"}</p>
        <p className="text-xs text-ink-400">{w.job?.customer?.name ?? ""}</p>
      </div>
    ),
  },
  {
    key: "elastics",
    header: "Elastics",
    cellClassName: "whitespace-normal",
    render: (w) => {
      const names = elasticNames(w.elasticOrdered);
      if (names.length === 0) return "—";
      return (
        <div className="max-w-[22rem] break-words text-ink-600">{names.join(", ")}</div>
      );
    },
  },
  {
    key: "plan",
    header: "Plan",
    render: (w) =>
      w.warpingPlan ? (
        <span className="text-status-success text-sm font-medium">
          {"noOfBeams" in (w.warpingPlan as object) && (w.warpingPlan as { noOfBeams?: number }).noOfBeams
            ? `${(w.warpingPlan as { noOfBeams?: number }).noOfBeams} beams`
            : "Ready"}
        </span>
      ) : (
        <span className="text-ink-400 text-sm">Not planned</span>
      ),
  },
  {
    key: "date",
    header: "Date",
    render: (w) => (w.date ? new Date(w.date).toLocaleDateString() : "—"),
  },
  { key: "status", header: "Status", render: (w) => <ProgrammeChip status={w.status} /> },
];

export function WarpingListPage() {
  const [status, setStatus] = useState<ProgrammeStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useWarpings({ status, search, page });

  return (
    <>
      <PageHeader
        title="Warping"
        subtitle="Warping programmes are opened automatically when a job is created."
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
          options={[...STATUS_OPTIONS]}
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
          rows={data?.data ?? []}
          rowKey={(w) => w._id}
          onRowClick={(w) => navigate(`/warping/${w._id}`)}
          loading={isLoading}
          emptyTitle="No warping programmes"
        />
      </Card>
    </>
  );
}
