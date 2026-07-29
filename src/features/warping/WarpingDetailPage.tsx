import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Play, CheckCircle2, XCircle, Plus, Printer, Tags, Trash2, Wand2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { warpingService } from "./api";
import { useWarping, useWarpingPlan, useWarpingMutations } from "./hooks";
import { ProgrammeChip, ElasticLines } from "./programmeShared";
import { WarpingPlanForm } from "./WarpingPlanForm";
import { WarpingProgrammeSheet, BeamLabels } from "./WarpingPrints";

export function WarpingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: warping, isLoading, isError, error } = useWarping(id);
  const plan = useWarpingPlan(id);
  const { start, complete, cancel, deletePlan } = useWarpingMutations();
  const [planOpen, setPlanOpen] = useState(false);
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [delPlanOpen, setDelPlanOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState<null | "sheet" | "labels">(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !warping) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Warping not found"}
      </p>
    );
  }

  const run = (mutation: typeof start, msg: string) =>
    mutation.mutate(warping._id, {
      onSuccess: () => toast(msg, "success"),
      onError: (e) => toast(e instanceof ApiError ? e.message : "Action failed", "error"),
    });

  const hasPlan = plan.data?.exists;

  return (
    <>
      <Link to="/warping" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Warping
      </Link>
      <PageHeader
        title={`Warping — J-${warping.job?.jobOrderNo ?? ""}`}
        subtitle={warping.job?.customer?.name}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPrintOpen("sheet")}>
              <Printer className="h-4 w-4" /> Programme
            </Button>
            {hasPlan && (
              <Button variant="secondary" onClick={() => setPrintOpen("labels")}>
                <Tags className="h-4 w-4" /> Beam labels
              </Button>
            )}
            {warping.status === "open" && !hasPlan && (
              <>
                <Button variant="secondary" onClick={() => setOptimizeOpen(true)}>
                  <Wand2 className="h-4 w-4" /> Optimize layout
                </Button>
                <Button onClick={() => setPlanOpen(true)}>
                  <Plus className="h-4 w-4" /> Create plan
                </Button>
              </>
            )}
            {warping.status === "open" && hasPlan && (
              <>
                <Button variant="secondary" onClick={() => setDelPlanOpen(true)}>
                  <Trash2 className="h-4 w-4" /> Delete plan
                </Button>
                <Button loading={start.isPending} onClick={() => run(start, "Warping started")}>
                  <Play className="h-4 w-4" /> Start
                </Button>
              </>
            )}
            {warping.status === "in_progress" && (
              <Button loading={complete.isPending} onClick={() => run(complete, "Warping completed")}>
                <CheckCircle2 className="h-4 w-4" /> Complete
              </Button>
            )}
            {(warping.status === "open" || warping.status === "in_progress") && (
              <Button variant="danger" loading={cancel.isPending} onClick={() => run(cancel, "Warping cancelled")}>
                <XCircle className="h-4 w-4" /> Cancel
              </Button>
            )}
          </>
        }
      />

      <ReasonDialog
        open={delPlanOpen}
        onClose={() => setDelPlanOpen(false)}
        title="Delete warping plan"
        description="Removes the beam plan so a corrected one can be created. Recorded in the audit trail."
        confirmLabel="Delete plan"
        loading={deletePlan.isPending}
        onConfirm={(reason) => {
          const planId = plan.data?.plan?._id;
          if (!planId) { toast("No plan to delete", "error"); return; }
          deletePlan.mutate(
            { planId, auditReason: reason },
            {
              onSuccess: () => { toast("Warping plan deleted", "success"); setDelPlanOpen(false); },
              onError: (e) => toast(e instanceof ApiError ? e.message : "Delete failed", "error"),
            }
          );
        }}
      />

      <Card className="p-6">
        <div className="mb-4">
          <ProgrammeChip status={warping.status} />
        </div>
        <DescriptionList
          columns={3}
          items={[
            {
              label: "Job",
              value: warping.job ? (
                <Link to={`/jobs/${warping.job._id}`} className="text-brand-600 hover:underline">
                  J-{warping.job.jobOrderNo}
                </Link>
              ) : undefined,
            },
            { label: "Opened", value: warping.date ? new Date(warping.date).toLocaleDateString() : undefined },
            {
              label: "Completed",
              value: warping.completedDate
                ? new Date(warping.completedDate).toLocaleDateString()
                : undefined,
            },
          ]}
        />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold">Elastics on this programme</h3>
          <div className="mt-2">
            <ElasticLines lines={warping.elasticOrdered} />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold">Warping plan</h3>
          {!hasPlan ? (
            <EmptyState
              title="No plan yet"
              description="Create the beam & section plan before starting the warping."
              action={
                warping.status === "open" ? (
                  <Button size="sm" onClick={() => setPlanOpen(true)}>
                    <Plus className="h-4 w-4" /> Create plan
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="mt-2 space-y-3">
              {(plan.data?.plan?.beams ?? []).map((beam, bi) => (
                <div key={bi} className="rounded-xl border border-ink-100 p-3">
                  <p className="text-sm font-semibold">
                    Beam {beam.beamNo ?? bi + 1}
                    {beam.totalEnds ? (
                      <span className="ml-2 text-xs font-normal text-ink-400">
                        {beam.totalEnds} total ends
                      </span>
                    ) : null}
                  </p>
                  <ul className="mt-1.5 divide-y divide-ink-100">
                    {beam.sections.map((s, si) => (
                      <li key={si} className="flex justify-between py-1.5 text-sm">
                        <span>
                          {typeof s.warpYarn === "object" && s.warpYarn ? s.warpYarn.name : "—"}
                        </span>
                        <span className="tabular-nums text-ink-600">
                          {s.ends} ends{s.maxMeters ? ` · ${s.maxMeters} m` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {plan.data?.plan?.remarks && (
                <p className="text-xs text-ink-400">Remarks: {plan.data.plan.remarks}</p>
              )}
            </div>
          )}
        </Card>
      </div>

      <WarpingProgrammeSheet
        open={printOpen === "sheet"}
        onClose={() => setPrintOpen(null)}
        warping={warping}
        plan={plan.data?.plan}
      />
      <BeamLabels
        open={printOpen === "labels"}
        onClose={() => setPrintOpen(null)}
        warping={warping}
        plan={plan.data?.plan}
      />

      <FormScreen open={planOpen} onClose={() => setPlanOpen(false)} title="Create warping plan" width="max-w-2xl">
        <WarpingPlanForm
          warpingId={warping._id}
          jobId={warping.job?._id}
          onDone={() => {
            setPlanOpen(false);
            plan.refetch();
          }}
          onCancel={() => setPlanOpen(false)}
        />
      </FormScreen>

      {optimizeOpen && (
        <OptimizeLayoutModal
          warpingId={warping._id}
          onClose={() => setOptimizeOpen(false)}
          onApplied={() => { setOptimizeOpen(false); plan.refetch(); }}
        />
      )}
    </>
  );
}

function OptimizeLayoutModal({
  warpingId,
  onClose,
  onApplied,
}: {
  warpingId: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { toast } = useToast();
  const { createPlan } = useWarpingMutations();
  const [capacity, setCapacity] = useState(600);

  const { data, isFetching } = useQuery({
    queryKey: ["warp-optimize", warpingId, capacity],
    queryFn: () => warpingService.optimizeLayout(warpingId, capacity),
    staleTime: 30_000,
  });

  const apply = () => {
    if (!data?.beams || data.beams.length === 0) return;
    createPlan.mutate(
      {
        warpingId,
        beams: data.beams.map((b) => ({
          sections: b.sections.map((s) => ({ warpYarn: s.warpYarnId, ends: s.ends, maxMeters: 0 })),
        })),
        remarks: `AI-optimised layout · ${data.metrics?.beamsUsed} beams · ${data.metrics?.fillRate}% fill`,
      },
      {
        onSuccess: () => { toast("Optimised plan applied", "success"); onApplied(); },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Failed to apply", "error"),
      }
    );
  };

  const m = data?.metrics;

  return (
    <FormScreen open onClose={onClose} title="Optimize warping layout" width="max-w-2xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-ink-600">Beam capacity (ends)</label>
          <div className="flex items-center gap-1 rounded-lg bg-ink-100 p-1">
            {[300, 600, 900, 1200].map((c) => (
              <button
                key={c}
                onClick={() => setCapacity(c)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-sm font-medium",
                  capacity === c ? "bg-surface text-ink-900 shadow-sm" : "text-ink-600"
                )}
              >
                {c}
              </button>
            ))}
          </div>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-ink-400" />}
        </div>

        {!isFetching && data && (!data.beams || data.beams.length === 0) ? (
          <EmptyState title="Nothing to optimise" description={data.message || "No warp-yarn ends found on this warping."} />
        ) : m ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-canvas p-3">
                <p className="text-xs text-ink-400">Beams</p>
                <p className="text-xl font-bold tabular-nums">{m.beamsUsed}</p>
              </div>
              <div className="rounded-lg bg-canvas p-3">
                <p className="text-xs text-ink-400">Beams saved</p>
                <p className={cn("text-xl font-bold tabular-nums", m.beamsSaved > 0 ? "text-status-success" : "")}>
                  {m.beamsSaved}
                </p>
              </div>
              <div className="rounded-lg bg-canvas p-3">
                <p className="text-xs text-ink-400">Fill rate</p>
                <p className="text-xl font-bold tabular-nums">{m.fillRate}%</p>
              </div>
              <div className="rounded-lg bg-canvas p-3">
                <p className="text-xs text-ink-400">Changeovers</p>
                <p className="text-xl font-bold tabular-nums">{m.changeovers}</p>
              </div>
            </div>

            <div className="space-y-2">
              {data!.beams!.map((b) => (
                <div key={b.beamNo} className="rounded-lg border border-ink-200 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-semibold">Beam {b.beamNo}</p>
                    <span className="text-xs text-ink-400">{b.totalEnds} ends · {b.fillPct}% full</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                    <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, b.fillPct)}%` }} />
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {b.sections.map((s, i) => (
                      <li key={i} className="flex justify-between text-sm">
                        <span>{s.warpYarnName}</span>
                        <span className="tabular-nums text-ink-600">{s.ends} ends</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="button" loading={createPlan.isPending} onClick={apply}>Apply as plan</Button>
            </div>
          </>
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </div>
    </FormScreen>
  );
}
