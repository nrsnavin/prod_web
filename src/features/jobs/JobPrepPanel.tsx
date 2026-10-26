import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ClipboardList, Play } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useAuth } from "@/core/auth/useAuth";
import { canAccessPath } from "@/app/navigation";
import { useWarpingMutations, useWarpingPlan } from "@/features/warping/hooks";
import { ProgrammeChip } from "@/features/warping/programmeShared";
import type { ProgrammeStatus } from "@/features/warping/types";
import type { JobDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  WARPING AND COVERING, ON THE JOB
//
//  A job leaves preparatory only once its warping and its covering are
//  both completed, so this is where the job page says how far each has
//  got, takes you to them — the warping's plan straight away — and
//  moves the warping on without leaving the job: Start once there is a
//  plan, Complete once the beams are built.
//
//  The same actions, and the same refusals, as the warping's own page:
//  completing while the yarn is still on the rack is held on screen with
//  the way through, not flashed past.
// ══════════════════════════════════════════════════════════════════

type Stage = { _id?: string; status: string; date?: string | null } | null | undefined;

const KNOWN: ProgrammeStatus[] = ["open", "in_progress", "completed", "cancelled"];
const chip = (status: string) =>
  KNOWN.includes(status as ProgrammeStatus) ? <ProgrammeChip status={status as ProgrammeStatus} /> : <span>{status}</span>;

export function JobPrepPanel({ job }: { job: Pick<JobDetail, "status" | "warping" | "covering"> }) {
  const { user } = useAuth();
  const canWarping = canAccessPath("/warping", user);
  const canCovering = canAccessPath("/covering", user);
  if (!job.warping && !job.covering) return null;

  return (
    <Card className="mt-4 p-5" aria-labelledby="job-prep-title">
      <h3 id="job-prep-title" className="font-semibold">Warping and covering</h3>
      <p className="text-sm text-ink-400">Both have to be completed before the job can move to weaving.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <WarpingBlock stage={job.warping} canOpen={canWarping} jobClosed={job.status === "cancelled" || job.status === "completed"} />
        <CoveringBlock stage={job.covering} canOpen={canCovering} />
      </div>
    </Card>
  );
}

function WarpingBlock({ stage, canOpen, jobClosed }: { stage: Stage; canOpen: boolean; jobClosed: boolean }) {
  const id = stage?._id;
  const plan = useWarpingPlan(canOpen && id ? id : undefined);
  const { start, complete } = useWarpingMutations();
  const { toast } = useToast();
  const [yarnBlocker, setYarnBlocker] = useState<string | null>(null);
  const [forceOpen, setForceOpen] = useState(false);

  if (!stage) {
    return (
      <section className="rounded-xl border border-dashed border-ink-200 p-4" aria-label="Warping">
        <h4 className="text-sm font-semibold">Warping</h4>
        <p className="mt-1 text-sm text-ink-400">No warping on this job.</p>
      </section>
    );
  }

  const hasPlan = !!plan.data?.exists;
  const beams = plan.data?.plan?.beams?.length ?? plan.data?.plan?.noOfBeams ?? 0;
  const active = !jobClosed && (stage.status === "open" || stage.status === "in_progress");

  const runStart = () =>
    start.mutate(id!, {
      onSuccess: () => toast("Warping started", "success"),
      onError: (e) => toast(e instanceof ApiError ? e.message : "Could not start the warping", "error"),
    });

  const runComplete = (forceReason?: string) =>
    complete.mutate(
      { id: id!, forceReason },
      {
        onSuccess: () => {
          setYarnBlocker(null);
          toast("Warping completed", "success");
        },
        onError: (e) => {
          if (e instanceof ApiError && e.code === "WARPING_YARN_NOT_ISSUED") {
            setYarnBlocker(e.message);
            return;
          }
          toast(e instanceof ApiError ? e.message : "Could not complete the warping", "error");
        },
      }
    );

  return (
    <section className="rounded-xl border border-ink-200 p-4" aria-label="Warping">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Warping</h4>
        {chip(stage.status)}
      </div>

      {/* The plan: what Start needs, and where the beams are laid out. */}
      {canOpen && id && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <ClipboardList className="h-4 w-4 text-ink-400" aria-hidden />
          {plan.isLoading ? (
            <span className="text-ink-400">Checking the plan…</span>
          ) : hasPlan ? (
            <>
              <span>Plan: {beams} beam{beams === 1 ? "" : "s"}</span>
              <Link to={`/warping/${id}#plan`} className="font-medium text-brand-600 hover:underline">View plan</Link>
            </>
          ) : (
            <>
              <span className="text-ink-500">No plan yet</span>
              {stage.status === "open" && !jobClosed && (
                <Link to={`/warping/${id}?plan=create#plan`} className="font-medium text-brand-600 hover:underline">Create the plan</Link>
              )}
            </>
          )}
        </p>
      )}

      {yarnBlocker && (
        <div className="mt-3 rounded-lg bg-status-warningBg px-3 py-2 text-sm" role="alert">
          <p className="font-medium text-status-warning">Not completed — the yarn is still on the rack</p>
          <p className="mt-0.5 text-ink-600">{yarnBlocker}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to={`/warping/${id}`}>
              <Button size="sm" variant="secondary">Issue the batch</Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={() => setForceOpen(true)}>Complete anyway…</Button>
            <Button size="sm" variant="ghost" onClick={() => setYarnBlocker(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canOpen && active && stage.status === "open" && (
          <Button
            size="sm"
            onClick={runStart}
            loading={start.isPending}
            disabled={plan.isLoading || !hasPlan}
            title={hasPlan ? "Start the warping" : "Create a warping plan before starting"}
          >
            <Play className="h-4 w-4" aria-hidden /> Start warping
          </Button>
        )}
        {canOpen && active && stage.status === "in_progress" && (
          <Button size="sm" onClick={() => runComplete()} loading={complete.isPending}>
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Complete warping
          </Button>
        )}
        {canOpen && id && (
          <Link to={`/warping/${id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
            Open warping <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>

      <ReasonDialog
        open={forceOpen}
        onClose={() => setForceOpen(false)}
        title="Complete without issuing the yarn"
        description="For beams already off the machine — warping that ran before the yarn was recorded against a batch. The reason is kept on the job's audit trail."
        confirmLabel="Complete anyway"
        minLength={5}
        loading={complete.isPending}
        onConfirm={(reason) => {
          runComplete(reason);
          setForceOpen(false);
        }}
      />
    </section>
  );
}

function CoveringBlock({ stage, canOpen }: { stage: Stage; canOpen: boolean }) {
  if (!stage) {
    return (
      <section className="rounded-xl border border-dashed border-ink-200 p-4" aria-label="Covering">
        <h4 className="text-sm font-semibold">Covering</h4>
        <p className="mt-1 text-sm text-ink-400">No covering on this job.</p>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-ink-200 p-4" aria-label="Covering">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Covering</h4>
        {chip(stage.status)}
      </div>
      {canOpen && stage._id && (
        <div className="mt-3">
          <Link to={`/covering/${stage._id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
            Open covering <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}
