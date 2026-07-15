import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Printer, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { usePackingGrouped, usePackingByJob, usePackingMutations } from "./hooks";
import { PackingRecord } from "./types";
import { PackingForm } from "./PackingForm";
import { PackingSlip } from "./PackingSlip";

function name(x?: { name: string } | string | null): string {
  return typeof x === "object" && x ? x.name : "—";
}

function JobPackings({
  jobId,
  jobNo,
  customerName,
}: {
  jobId: string;
  jobNo?: number | string;
  customerName?: string;
}) {
  const { data, isLoading } = usePackingByJob(jobId);
  const { remove } = usePackingMutations();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<PackingRecord | null>(null);
  const [editing, setEditing] = useState<PackingRecord | null>(null);
  const [printing, setPrinting] = useState<PackingRecord | null>(null);

  const columns: Column<PackingRecord>[] = [
    { key: "elastic", header: "Elastic", render: (p) => name(p.elastic) },
    { key: "meter", header: "Meters", align: "right", render: (p) => p.meter.toLocaleString("en-IN") },
    { key: "net", header: "Net (kg)", align: "right", render: (p) => p.netWeight ?? "—" },
    { key: "gross", header: "Gross (kg)", align: "right", render: (p) => p.grossWeight ?? "—" },
    { key: "checked", header: "Checked by", render: (p) => name(p.checkedBy) },
    { key: "packed", header: "Packed by", render: (p) => name(p.packedBy) },
    {
      key: "date",
      header: "Date",
      render: (p) => (p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"),
    },
    {
      key: "act",
      header: "",
      align: "right",
      render: (p) => (
        <span className="inline-flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPrinting(p);
            }}
            className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-900"
            aria-label="Print packing slip"
          >
            <Printer className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditing(p);
            }}
            className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-900"
            aria-label="Edit packing"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleting(p);
            }}
            className="p-1.5 rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger"
            aria-label="Delete packing"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(p) => p._id}
        emptyTitle="No boxes packed yet"
      />
      {printing && (
        <PackingSlip
          open
          onClose={() => setPrinting(null)}
          record={printing}
          jobNo={jobNo}
          customerName={customerName}
        />
      )}
      {editing && <PackingEditModal record={editing} onClose={() => setEditing(null)} />}
      <ReasonDialog
        open={!!deleting}
        title="Delete packing record"
        description="The packed quantity, stock and produced counters are reversed. Recorded in the audit trail."
        confirmLabel="Delete"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={(reason) =>
          deleting &&
          remove.mutate(
            { id: deleting._id, auditReason: reason },
            {
              onSuccess: () => { setDeleting(null); toast("Packing record deleted", "success"); },
              onError: (e) => toast(e instanceof ApiError ? e.message : "Delete failed", "error"),
            }
          )
        }
      />
    </>
  );
}

function PackingEditModal({ record, onClose }: { record: PackingRecord; onClose: () => void }) {
  const { update } = usePackingMutations();
  const { toast } = useToast();
  const [meter, setMeter] = useState(String(record.meter));
  const [auditReason, setAuditReason] = useState("");

  const save = () => {
    if (auditReason.trim().length < 3) { toast("Give a reason (min 3 chars) for the edit", "error"); return; }
    if (!(Number(meter) > 0)) { toast("Meters must be greater than 0", "error"); return; }
    update.mutate(
      { id: record._id, body: { meter: Number(meter), auditReason: auditReason.trim() } },
      {
        onSuccess: () => { toast("Packing updated", "success"); onClose(); },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Update failed", "error"),
      }
    );
  };

  return (
    <FormScreen open onClose={onClose} title="Edit packing" width="max-w-md">
      <div className="space-y-4">
        <Input label="Meters *" type="number" step="0.01" value={meter} onChange={(e) => setMeter(e.target.value)} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-600">Reason for edit *</label>
          <textarea
            rows={2}
            value={auditReason}
            onChange={(e) => setAuditReason(e.target.value)}
            placeholder="Why is this being changed? (recorded in the audit log)"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <p className="text-xs text-ink-400">Adjusting meters re-derives the job's packed quantity, stock and produced counters by the difference.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={update.isPending} onClick={save}>Save changes</Button>
        </div>
      </div>
    </FormScreen>
  );
}

export function PackingPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const { toast } = useToast();
  const grouped = usePackingGrouped();
  const { create } = usePackingMutations();

  return (
    <>
      <PageHeader
        title="Packing"
        subtitle="Boxes packed per job — expand a job for its packing slips."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add packing
          </Button>
        }
      />

      {grouped.isError && (
        <p className="mb-4 rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
          {(grouped.error as Error).message}
        </p>
      )}

      {grouped.isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (grouped.data?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            title="Nothing packed yet"
            description="Packing entries appear once jobs reach the packing stage."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.data!.map((g) => {
            const jobId = g.job._id ?? String(g.job.jobOrderNo);
            const expanded = expandedJob === jobId;
            return (
              <Card key={jobId}>
                <button
                  onClick={() => setExpandedJob(expanded ? null : jobId)}
                  className="w-full flex items-center gap-4 p-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">J-{g.job.jobOrderNo}</p>
                    <p className="text-xs text-ink-400">{g.job.customer?.name ?? ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {g.totalMeters.toLocaleString("en-IN")} m
                    </p>
                    <p className="text-xs text-ink-400">{g.totalBoxes} boxes</p>
                  </div>
                  {expanded ? (
                    <ChevronUp className="h-4 w-4 text-ink-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-ink-400" />
                  )}
                </button>
                {expanded && g.job._id && (
                  <JobPackings
                    jobId={g.job._id}
                    jobNo={g.job.jobOrderNo}
                    customerName={g.job.customer?.name ?? undefined}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}

      <FormScreen open={addOpen} onClose={() => setAddOpen(false)} title="Add packing" width="max-w-xl">
        <PackingForm
          submitting={create.isPending}
          onCancel={() => setAddOpen(false)}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: () => {
                setAddOpen(false);
                toast("Packing recorded", "success");
              },
              onError: (e) =>
                toast(e instanceof ApiError ? e.message : "Failed to record packing", "error"),
            })
          }
        />
      </FormScreen>
    </>
  );
}
