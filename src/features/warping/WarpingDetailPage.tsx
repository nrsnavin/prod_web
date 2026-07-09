import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, CheckCircle2, XCircle, Plus, Printer, Tags } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useWarping, useWarpingPlan, useWarpingMutations } from "./hooks";
import { ProgrammeChip, ElasticLines } from "./programmeShared";
import { WarpingPlanForm } from "./WarpingPlanForm";
import { WarpingProgrammeSheet, BeamLabels } from "./WarpingPrints";

export function WarpingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: warping, isLoading, isError, error } = useWarping(id);
  const plan = useWarpingPlan(id);
  const { start, complete, cancel } = useWarpingMutations();
  const [planOpen, setPlanOpen] = useState(false);
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
              <Button onClick={() => setPlanOpen(true)}>
                <Plus className="h-4 w-4" /> Create plan
              </Button>
            )}
            {warping.status === "open" && hasPlan && (
              <Button loading={start.isPending} onClick={() => run(start, "Warping started")}>
                <Play className="h-4 w-4" /> Start
              </Button>
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
                          {s.ends} ends{s.length ? ` · ${s.length} m` : ""}
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

      <Modal open={planOpen} onClose={() => setPlanOpen(false)} title="Create warping plan" width="max-w-2xl">
        <WarpingPlanForm
          warpingId={warping._id}
          jobId={warping.job?._id}
          onDone={() => {
            setPlanOpen(false);
            plan.refetch();
          }}
          onCancel={() => setPlanOpen(false)}
        />
      </Modal>
    </>
  );
}
