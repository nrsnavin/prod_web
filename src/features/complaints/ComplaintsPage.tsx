import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PackageX, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { complaintService } from "./api";
import { BlastRadiusPanel } from "./BlastRadiusPanel";
import { ThemesPanel } from "./ThemesPanel";
import { FileComplaintModal } from "./FileComplaintModal";
import {
  COMPLAINT_STATUSES, type ComplaintRow, type ComplaintStatus,
} from "./types";

// ══════════════════════════════════════════════════════════════════
//  COMPLAINTS, AND THE LOT TRAIL BEHIND THEM
//
//  The Complaint model existed in this codebase for a long time with no
//  routes and no screen — nothing could file one, read one or resolve
//  one. This page is the first way in.
//
//  ── The layout says what to do first ─────────────────────────────
//  Selecting a complaint opens the blast radius ABOVE the resolution
//  box. Recording what was done about one customer's roll is
//  bookkeeping; finding the six other orders carrying the same lot is
//  the thing with a clock on it. The screen is ordered to match.
// ══════════════════════════════════════════════════════════════════

const STATUS_TONE: Record<ComplaintStatus, "danger" | "warning" | "success" | "neutral"> = {
  Open: "danger",
  InReview: "warning",
  Resolved: "success",
  Rejected: "neutral",
  Closed: "neutral",
};

function ComplaintListRow({
  row, selected, onSelect,
}: { row: ComplaintRow; selected: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        onClick={onSelect}
        className={cn(
          "w-full border-t border-ink-100 px-3 py-2.5 text-left transition-colors first:border-t-0",
          selected ? "bg-surface-2" : "hover:bg-surface-2/60"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{row.customer?.name ?? "Unknown customer"}</span>
          <StatusChip tone={STATUS_TONE[row.status]}>{row.status}</StatusChip>
        </div>
        <p className="mt-0.5 truncate text-sm text-ink-500">{row.reason}</p>
        <p className="mt-0.5 text-xs text-ink-400 tabular-nums">
          {new Date(row.date).toLocaleDateString("en-IN")}
          {row.job?.jobNo != null && ` · Job ${row.job.jobNo}`}
          {" · "}{row.category}
        </p>
      </button>
    </li>
  );
}

function Resolution({ complaint }: { complaint: ComplaintRow }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<ComplaintStatus>(complaint.status);
  const [resolution, setResolution] = useState(complaint.resolution ?? "");

  const save = useMutation({
    mutationFn: () => complaintService.update(complaint._id, { status, resolution }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["complaints"] });
      toast("Saved", "success");
    },
    onError: () => toast("Could not save that", "error"),
  });

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
        What was found
      </h2>
      <div className="mt-3 space-y-3">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ComplaintStatus)}
          options={COMPLAINT_STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Resolution</span>
          <textarea
            className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm"
            rows={4}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Lot D-4471 quarantined; two beams re-warped."
          />
        </label>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

export function ComplaintsPage() {
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [filing, setFiling] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["complaints", status],
    queryFn: () => complaintService.list({ status, limit: 100 }),
  });

  const rows = data?.data ?? [];
  const current = rows.find((r) => r._id === selected) ?? null;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <PackageX className="h-5 w-5" /> Complaints
          </h1>
          <p className="mt-0.5 text-sm text-ink-400">
            What customers reported, and which other orders carry the same yarn.
          </p>
        </div>
        <Button onClick={() => setFiling(true)}>
          <Plus className="h-4 w-4" /> File a complaint
        </Button>
      </div>

      <ThemesPanel />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 p-3">
            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: "all", label: "All statuses" },
                ...COMPLAINT_STATUSES.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>
          {/* Three branches, never two. This screen is the one the UX
              audit photographed: with the API returning 500 it said
              "No complaints — nothing has been filed under this filter",
              which is a quality manager being told, in a calm grey box,
              that no customer has complained. The failure is checked
              FIRST, because a failed query also has no rows. */}
          {isLoading ? (
            <Skeleton className="m-3 h-64" />
          ) : isError ? (
            <ErrorState error={error} what="complaints" onRetry={() => refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No complaints"
              description="Nothing has been filed under this filter."
            />
          ) : (
            <ul>
              {rows.map((r) => (
                <ComplaintListRow
                  key={r._id}
                  row={r}
                  selected={r._id === selected}
                  onSelect={() => setSelected(r._id)}
                />
              ))}
            </ul>
          )}
        </Card>

        <div>
          {current ? (
            <>
              {/* The blast radius sits above the resolution box on
                  purpose — it is the half with a clock on it. */}
              <BlastRadiusPanel key={current._id} complaintId={current._id} />
              <Resolution key={`${current._id}-res`} complaint={current} />
            </>
          ) : (
            <Card className="p-8">
              <EmptyState
                title="Pick a complaint"
                description="Selecting one shows every other job carrying the same yarn lot, and which of those have already shipped."
              />
            </Card>
          )}
        </div>
      </div>

      {filing && <FileComplaintModal onClose={() => setFiling(false)} />}
    </div>
  );
}

export default ComplaintsPage;
