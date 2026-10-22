import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Cog, ArrowRight, XCircle, FileText, Check, AlertTriangle, Pencil, QrCode } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { JobQrPrint } from "./JobQrPrint";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useJob, useJobMutations, useJobSummary, useWeavingReadiness } from "./hooks";
import { JOB_PIPELINE, JobShiftDetail, JobSummaryRow } from "./types";
import { nextJobStatus } from "./jobStatus";
import { MachineAssignModal } from "./MachineAssignModal";
import { JobElasticsEditModal, canEditElastics, editableReason } from "./JobElasticsEditModal";
import { JobChangeElasticModal } from "./JobChangeElasticModal";
import { QcPanel } from "./QcPanel";
import { OutsourcingPanel } from "./OutsourcingPanel";
import { JobYarnLots } from "./JobYarnLots";
import { JobShiftSummary } from "./JobShiftSummary";
import { useTrackRecent } from "@/core/ui/uiStore";
import { useAuth } from "@/core/auth/useAuth";
import { canAccessPath } from "@/app/navigation";

function Pipeline({ status }: { status: string }) {
  const activeIdx = JOB_PIPELINE.indexOf(status as (typeof JOB_PIPELINE)[number]);
  if (status === "cancelled") {
    return <StatusChip tone="neutral">cancelled</StatusChip>;
  }
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {JOB_PIPELINE.map((stage, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <li key={stage} className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                done && "bg-status-successBg text-status-success",
                active && "bg-brand-500 text-white",
                !done && !active && "bg-ink-100 text-ink-400"
              )}
            >
              {done && <Check className="h-3 w-3" />}
              {stage}
            </span>
            {i < JOB_PIPELINE.length - 1 && <span className="text-ink-200">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

const summaryColumns: Column<JobSummaryRow>[] = [
  {
    key: "name",
    header: "Elastic",
    render: (r) => (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="font-medium">{r.elasticName}</span>
        {/* Changed mid-run: a frozen line is complete as it stands and
            takes nothing more; an added one came in with a reason. */}
        {r.frozen && <StatusChip tone="neutral">Frozen</StatusChip>}
        {r.addedMidRun && <StatusChip tone="info">Added mid-run</StatusChip>}
      </span>
    ),
  },
  {
    key: "planned",
    header: "Planned",
    align: "right",
    render: (r) => (
      <span className="tabular-nums">
        {r.planned.toLocaleString("en-IN")}
        {r.frozen && r.plannedBeforeFreeze != null && (
          <span className="block text-xs text-ink-400" title="Planned before it was frozen at what was woven">
            was {r.plannedBeforeFreeze.toLocaleString("en-IN")}
          </span>
        )}
      </span>
    ),
  },
  { key: "produced", header: "Produced", align: "right", render: (r) => r.produced.toLocaleString("en-IN") },
  { key: "packed", header: "Packed", align: "right", render: (r) => r.packed.toLocaleString("en-IN") },
  {
    key: "wasted",
    header: "Wasted",
    align: "right",
    render: (r) => (
      <span className={r.wasted > 0 ? "text-status-danger" : "text-ink-400"}>
        {r.wasted.toLocaleString("en-IN")}
      </span>
    ),
  },
  { key: "remaining", header: "Remaining", align: "right", render: (r) => r.remaining.toLocaleString("en-IN") },
  { key: "pct", header: "Packing %", align: "right", render: (r) => `${r.packingPct}%` },
];

const shiftColumns: Column<JobShiftDetail>[] = [
  { key: "date", header: "Date", render: (s) => s.date },
  {
    key: "shift",
    header: "Shift",
    render: (s) => <StatusChip tone={s.shift === "DAY" ? "info" : "neutral"}>{s.shift}</StatusChip>,
  },
  { key: "machine", header: "Machine", render: (s) => s.machineName },
  { key: "operator", header: "Operator", render: (s) => s.operatorName },
  { key: "timer", header: "Runtime", align: "right", render: (s) => s.timer },
  {
    key: "prod",
    header: "Output (m)",
    align: "right",
    // An unverified figure is the operator's own claim. Marking it beats
    // printing it identically to a checked one.
    render: (s) => (
      <span className={s.verified === false ? "text-ink-400" : undefined}>
        {s.productionMeters.toLocaleString("en-IN")}
        {s.verified === false ? " *" : ""}
      </span>
    ),
  },
  { key: "status", header: "Status", render: (s) => <StatusChip tone="neutral">{s.status}</StatusChip> },
];

/**
 * The job's warping or covering: its status, as a link to that record's
 * own page — where it is planned and completed — for anyone who can open it.
 */
function StageLink({ stage, path, name }: {
  stage?: { _id?: string; status: string } | null; path: string; name: string;
}) {
  const { user } = useAuth();
  if (!stage) return <span className="text-ink-400">None</span>;
  if (!stage._id || !canAccessPath(path, user)) return <>{stage.status}</>;
  return (
    <Link
      to={`${path}/${stage._id}`}
      aria-label={`Open the ${name} (${stage.status})`}
      className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
    >
      {stage.status} <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

/** "8 heads", or "6 of 8 heads" when the job runs fewer than the loom has. */
export function headsLabel(inUse: number | undefined, total: number): string {
  return inUse != null && inUse > 0 && inUse < total ? `${inUse} of ${total} heads` : `${total} heads`;
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: job, isLoading, isError, error } = useJob(id);
  const summary = useJobSummary(id);
  const readiness = useWeavingReadiness(id, job?.status === "preparatory");
  const { updateStatus, cancel } = useJobMutations();
  const [assignOpen, setAssignOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  // Set from the server's 409 WEAVING_NOT_READY. Holding the blockers in
  // state (rather than toasting the message) means the user gets a list
  // they can read and act on, and the job status is visibly unchanged.
  const [weavingBlockers, setWeavingBlockers] = useState<string[] | null>(null);
  useTrackRecent("Job", `/jobs/${id}`, job ? `${job.jobNo} · ${job.customerName}` : undefined);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !job) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Job not found"}
      </p>
    );
  }

  const next = nextJobStatus[job.status];
  const terminal = job.status === "completed" || job.status === "cancelled";

  return (
    <>
      <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Job orders
      </Link>
      <PageHeader
        title={job.jobNo}
        subtitle={`${job.customerName}${job.orderNo ? ` · Order #${job.orderNo}` : ""}`}
        actions={
          <>
            <Link to={`/jobs/${job.id}/mrp`}>
              <Button variant="secondary">
                <FileText className="h-4 w-4" /> MRP sheet
              </Button>
            </Link>
            {/* Available at every status, including cancelled: the
                label goes on the work, and somebody chasing a job
                months later wants the same one. */}
            <Button variant="secondary" onClick={() => setQrOpen(true)}>
              <QrCode className="h-4 w-4" /> QR label
            </Button>
            {/* Only while nothing is committed to these figures. The
                reason is on the button's title rather than hidden, so
                somebody who expected it can see why it has gone. */}
            {["preparatory", "weaving", "finishing", "checking"].includes(job.status) && (
              <Button
                variant="secondary"
                disabled={!canEditElastics(job)}
                title={editableReason(job) ?? "Change the planned quantities"}
                onClick={() => setQtyOpen(true)}
              >
                <Pencil className="h-4 w-4" /> Edit quantities
              </Button>
            )}
            {/* The exceptional case: the loom goes on to another of
                the order's elastics mid-run, with a reason. */}
            {["weaving", "finishing", "checking"].includes(job.status) && (
              <Button variant="secondary" onClick={() => setChangeOpen(true)}>
                <Pencil className="h-4 w-4" /> Change elastic
              </Button>
            )}
            {/* Weaving too, not just preparatory: a machine can break
                down mid-run, and the job then has to be moved to a
                working one. The old machine is freed server-side. */}
            {(job.status === "preparatory" || job.status === "weaving") && (
              <Button
                variant={job.machine ? "secondary" : "primary"}
                onClick={() => setAssignOpen(true)}
              >
                <Cog className="h-4 w-4" />{" "}
                {job.machine ? "Change machine" : "Assign machine"}
              </Button>
            )}
            {next && (
              <Button
                loading={updateStatus.isPending}
                onClick={() =>
                  updateStatus.mutate(
                    { jobId: job.id, nextStatus: next },
                    {
                      onSuccess: () => toast(`Job moved to ${next}`, "success"),
                      onError: (e) => {
                        // Preparatory work still open: show the list of
                        // what is holding the job back rather than a
                        // one-line toast the user has to decode.
                        if (e instanceof ApiError && e.code === "WEAVING_NOT_READY") {
                          const details = e.data?.details as
                            | { blockers?: string[] }
                            | undefined;
                          setWeavingBlockers(
                            details?.blockers?.length ? details.blockers : [e.message]
                          );
                          return;
                        }
                        toast(e instanceof ApiError ? e.message : "Status update failed", "error");
                      },
                    }
                  )
                }
              >
                <ArrowRight className="h-4 w-4" /> Move to {next}
              </Button>
            )}
            {!terminal && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                <XCircle className="h-4 w-4" /> Cancel job
              </Button>
            )}
          </>
        }
      />

      <Card className="p-6">
        <Pipeline status={job.status} />
        <div className="mt-5">
          <DescriptionList
            columns={3}
            items={[
              { label: "Date", value: job.date },
              {
                label: "Machine",
                value: job.machine ? (
                  // The machine page is where a loading loom is marked running.
                  <Link to={`/machines/${job.machine.machineId}`} className="text-brand-600 hover:underline">
                    {job.machine.machineName} · {headsLabel(job.machine.headsInUse, job.machine.machineNoOfHead)}
                    {job.machine.loading ? " · loading" : ""}
                  </Link>
                ) : "Not assigned",
              },
              { label: "Warping", value: <StageLink stage={job.warping} path="/warping" name="warping" /> },
              { label: "Covering", value: <StageLink stage={job.covering} path="/covering" name="covering" /> },
            ]}
          />
        </div>

        {/* Say up front whether the job can leave preparatory, so the
            answer isn't only available by pressing the button. */}
        {job.status === "preparatory" && readiness.data && (
          <div
            className={cn(
              "mt-4 rounded-lg px-3 py-2 text-sm",
              readiness.data.ready
                ? "bg-status-successBg text-status-success"
                : "bg-status-warningBg text-status-warning"
            )}
          >
            {readiness.data.ready ? (
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4" /> Warping and covering are both completed — this job
                can move to weaving.
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" /> Not ready for weaving
                </span>
                <ul className="mt-1 list-disc pl-8 text-xs">
                  {readiness.data.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <h3 className="font-semibold px-5 pt-5">Production summary</h3>
        <DataTable
          columns={summaryColumns}
          rows={summary.data ?? []}
          rowKey={(r) => r.elasticId}
          loading={summary.isLoading}
          emptyTitle="No summary available"
        />
      </Card>

      <Card className="mt-4">
        <h3 className="font-semibold px-5 pt-5">Shifts on this job</h3>
        {job.productionMode === "outsource" ? (
          // An outsourced job is made by a vendor, so it runs no shifts
          // here. The empty shift table would read as "nobody has recorded
          // anything yet"; the vendor record takes its place, and IS this
          // job's production record.
          <OutsourcingPanel
            jobId={job.id}
            vendor={job.outsourceVendor}
            record={job.outsourcing}
          />
        ) : (
          <>
            <JobShiftSummary summary={job.shiftSummary} />
            <DataTable
              columns={shiftColumns}
              rows={job.shiftDetails ?? []}
              rowKey={(s) => s.id}
              compactEmpty
              emptyTitle="No shifts recorded yet"
              emptyDescription="Shifts appear here once one is planned on the machine running this job."
            />
          </>
        )}
      </Card>

      <JobYarnLots jobId={job.id} />

      <QcPanel job={job} />

      {(job.wastages?.length ?? 0) > 0 && (
        <Card className="mt-4 p-5">
          <h3 className="font-semibold">Wastage</h3>
          <ul className="mt-3 divide-y divide-ink-100">
            {job.wastages.map((w) => (
              <li key={w.id} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{w.elasticName}</p>
                  <p className="text-xs text-ink-400">
                    {w.employeeName} · {w.reason} {w.date && `· ${w.date}`}
                  </p>
                </div>
                <span className="font-semibold tabular-nums text-status-danger">
                  {w.quantity.toLocaleString("en-IN")} m
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <MachineAssignModal job={job} open={assignOpen} onClose={() => setAssignOpen(false)} />

      {/* Keyed on the job's own figures so reopening after a save starts
          from what was stored, not the state it was left in. */}
      <JobQrPrint job={job} open={qrOpen} onClose={() => setQrOpen(false)} />

      {changeOpen && (
        <JobChangeElasticModal
          key={`${job.__v}:${job.plannedElastics.map((e) => e.elasticId).join("|")}`}
          job={job}
          open={changeOpen}
          onClose={() => setChangeOpen(false)}
        />
      )}

      {qtyOpen && (
        <JobElasticsEditModal
          key={job.plannedElastics.map((e) => `${e.elasticId}:${e.quantity}`).join("|")}
          job={job}
          open={qtyOpen}
          onClose={() => setQtyOpen(false)}
        />
      )}

      <Modal
        open={weavingBlockers !== null}
        onClose={() => setWeavingBlockers(null)}
        title="Job is not ready for weaving"
        width="max-w-md"
        confirmDirtyClose={false}
      >
        <p className="text-sm text-ink-600">
          A job moves to weaving only once its warping and its covering are both completed.{" "}
          <span className="font-medium">{job.jobNo} has kept its status.</span>
        </p>
        <ul className="mt-3 space-y-1.5">
          {(weavingBlockers ?? []).map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-status-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => setWeavingBlockers(null)}>Got it</Button>
        </div>
      </Modal>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Cancel ${job.jobNo}?`} width="max-w-sm">
        <p className="text-sm text-ink-600 mb-3">
          The machine is released, quantities return to the order's pending pool, and the order
          reverts to Approved if no other active jobs remain.
        </p>
        <Input
          label="Reason"
          placeholder="Optional"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep job</Button>
          <Button
            variant="danger"
            loading={cancel.isPending}
            onClick={() =>
              cancel.mutate(
                { jobId: job.id, reason: cancelReason || undefined },
                {
                  onSuccess: () => {
                    setCancelOpen(false);
                    toast("Job cancelled", "success");
                  },
                  onError: (e) =>
                    toast(e instanceof ApiError ? e.message : "Cancel failed", "error"),
                }
              )
            }
          >
            Cancel job
          </Button>
        </div>
      </Modal>
    </>
  );
}
