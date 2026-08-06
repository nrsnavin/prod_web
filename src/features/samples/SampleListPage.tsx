import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Camera, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useSamples } from "./hooks";
import { SampleCreateForm } from "./SampleCreateForm";
import { SampleStatusChip, formatWhen, formatQty } from "./sampleShared";
import { SampleRow, SampleStatus } from "./types";

// Every sample request, newest first. The row's job is to say what was
// asked for, for whom, and what happened LAST — a list of titles and
// dates would make people open all of them to find the one that moved.

const PAGE_SIZE = 25;

const lastLine = (row: SampleRow): string => {
  if (!row.lastEntry) return "—";
  const { kind, note, status } = row.lastEntry;
  if (kind === "status") return `Marked ${String(status).replace("_", " ")}${note ? ` — ${note}` : ""}`;
  if (kind === "photo") return note ? `Photo — ${note}` : "Photo added";
  if (kind === "photo_removed") return `Photo removed — ${note}`;
  if (kind === "created") return note || "Raised";
  return note;
};

const columns: Column<SampleRow>[] = [
  {
    key: "sampleNo",
    header: "Sample",
    render: (s) => (
      <div>
        <p className="font-medium tabular-nums">S-{s.sampleNo}</p>
        <p className="text-xs text-ink-400">{formatWhen(s.createdAt)}</p>
      </div>
    ),
  },
  {
    key: "title",
    header: "Asked for",
    cellClassName: "whitespace-normal",
    render: (s) => (
      <div className="max-w-[24rem]">
        <p className="font-medium">{s.title}</p>
        <p className="text-xs text-ink-400">
          {s.customerName || "No customer named"}
          {s.quantity > 0 ? ` · ${formatQty(s.quantity)} m` : ""}
        </p>
      </div>
    ),
  },
  {
    key: "lastEntry",
    header: "Last entry",
    cellClassName: "whitespace-normal",
    render: (s) => (
      <div className="max-w-[22rem]">
        <p className="text-ink-600 line-clamp-2">{lastLine(s)}</p>
        <p className="mt-0.5 flex items-center gap-3 text-xs text-ink-400">
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> {s.logCount}
          </span>
          {s.photoCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Camera className="h-3 w-3" /> {s.photoCount}
            </span>
          )}
          {s.lastEntry ? <span>{formatWhen(s.lastEntry.at)}</span> : null}
        </p>
      </div>
    ),
  },
  { key: "status", header: "Status", render: (s) => <SampleStatusChip status={s.status} /> },
];

export function SampleListPage() {
  const [status, setStatus] = useState<SampleStatus | "active" | "all">("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useSamples({
    status,
    q: search,
    page,
    limit: PAGE_SIZE,
  });

  const counts = data?.counts;
  const live = counts ? counts.open + counts.in_progress : undefined;
  const withCount = (label: string, n?: number) => (n === undefined ? label : `${label} (${n})`);

  return (
    <>
      <PageHeader
        title="Sample Requests"
        subtitle="One log per request — what was asked for, and everything that happened to it."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Raise sample
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
          placeholder="Search title, customer or sample number…"
          className="w-full max-w-xs"
        />
        <FilterChips
          options={[
            { value: "active", label: withCount("Live", live) },
            { value: "open", label: withCount("Open", counts?.open) },
            { value: "in_progress", label: withCount("In progress", counts?.in_progress) },
            { value: "completed", label: withCount("Completed", counts?.completed) },
            { value: "closed", label: withCount("Closed", counts?.closed) },
            { value: "all", label: "All" },
          ]}
          value={status}
          onChange={(v) => {
            setStatus(v as SampleStatus | "active" | "all");
            setPage(1);
          }}
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      <Card>
        <DataTable
          columns={columns}
          rows={data?.samples ?? []}
          rowKey={(s) => s._id}
          onRowClick={(s) => navigate(`/samples/${s._id}`)}
          loading={isLoading}
          emptyTitle="No sample requests"
          emptyDescription="Raise one when a customer asks for a trial piece."
        />
        <Pagination
          page={page}
          totalPages={data?.pages ?? 1}
          total={data?.total}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Raise a sample request"
        width="max-w-2xl"
      >
        <SampleCreateForm
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            navigate(`/samples/${id}`);
          }}
        />
      </Modal>
    </>
  );
}
