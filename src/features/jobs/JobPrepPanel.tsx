import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ClipboardList, Eye, Play, Plus, Printer, Scale, ScanText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useAuth } from "@/core/auth/useAuth";
import { canAccessPath } from "@/app/navigation";
import { useCoveringMutations, useWarpingMutations } from "@/features/warping/hooks";
import { coveringService } from "@/features/warping/api";
import type { JobDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  WARPING AND COVERING, ON THE JOB
//
//  A job leaves preparatory only once its warping and its covering are
//  both completed, so this is where the job page says how far each has
//  got and moves them on without leaving the job:
//
//    warping   started or not; its plan, made or not — Create warping
//              plan / View warping plan; Start warping once there is a
//              plan; Complete warping once the beams are built
//    covering  started or not; the beams weighed so far — Add covering
//              beam
//
//  Each opens its own page too. The same actions and refusals as those
//  pages: completing while the yarn is still on the rack is held on
//  screen with the way through, not flashed past.
// ══════════════════════════════════════════════════════════════════

type Job = Pick<JobDetail, "status" | "warping" | "covering">;

/** How a stage reads to the floor: started or not, not "open". */
const STAGE: Record<string, { label: string; tone: ChipTone }> = {
  open: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};
const stageChip = (status: string) => {
  const s = STAGE[status] ?? { label: status, tone: "neutral" as ChipTone };
  return <StatusChip tone={s.tone}>{s.label}</StatusChip>;
};

const kg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export function JobPrepPanel({ job }: { job: Job }) {
  const { user } = useAuth();
  const canWarping = canAccessPath("/warping", user);
  const canCovering = canAccessPath("/covering", user);
  if (!job.warping && !job.covering) return null;
  const jobClosed = job.status === "cancelled" || job.status === "completed";

  return (
    <Card className="mt-4 p-5" aria-labelledby="job-prep-title">
      <h3 id="job-prep-title" className="font-semibold">Warping and covering</h3>
      <p className="text-sm text-ink-400">Both have to be completed before the job can move to weaving.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <WarpingBlock stage={job.warping} canOpen={canWarping} jobClosed={jobClosed} />
        <CoveringBlock stage={job.covering} canOpen={canCovering} jobClosed={jobClosed} />
      </div>
    </Card>
  );
}

function Missing({ name }: { name: string }) {
  return (
    <section className="rounded-xl border border-dashed border-ink-200 p-4" aria-label={name}>
      <h4 className="text-sm font-semibold">{name}</h4>
      <p className="mt-1 text-sm text-ink-400">No {name.toLowerCase()} on this job.</p>
    </section>
  );
}

function WarpingBlock({ stage, canOpen, jobClosed }: { stage: Job["warping"]; canOpen: boolean; jobClosed: boolean }) {
  const { start, complete } = useWarpingMutations();
  const { toast } = useToast();
  const [yarnBlocker, setYarnBlocker] = useState<string | null>(null);
  const [forceOpen, setForceOpen] = useState(false);
  if (!stage) return <Missing name="Warping" />;

  const id = stage._id;
  const hasPlan = !!stage.hasPlan;
  const beams = stage.noOfBeams ?? 0;
  const active = !jobClosed && (stage.status === "open" || stage.status === "in_progress");
  const can = canOpen && !!id;

  const runStart = () =>
    start.mutate(id!, {
      onSuccess: () => toast("Warping started", "success"),
      onError: (e) => toast(e instanceof ApiError ? e.message : "Could not start the warping", "error"),
    });
  const runComplete = (forceReason?: string) =>
    complete.mutate(
      { id: id!, forceReason },
      {
        onSuccess: () => { setYarnBlocker(null); toast("Warping completed", "success"); },
        onError: (e) => {
          if (e instanceof ApiError && e.code === "WARPING_YARN_NOT_ISSUED") { setYarnBlocker(e.message); return; }
          toast(e instanceof ApiError ? e.message : "Could not complete the warping", "error");
        },
      }
    );

  return (
    <section className="rounded-xl border border-ink-200 p-4" aria-label="Warping">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">
          {can ? (
            <Link to={`/warping/${id}`} className="inline-flex items-center gap-1 hover:underline">
              Warping <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : "Warping"}
        </h4>
        {stageChip(stage.status)}
      </div>

      {/* The plan: what Start needs, and where the beams are laid out. */}
      <p className="mt-2 flex items-center gap-2 text-sm">
        <ClipboardList className="h-4 w-4 text-ink-400" aria-hidden />
        {hasPlan
          ? <span>Warping plan made{beams ? ` — ${beams} beam${beams === 1 ? "" : "s"}` : ""}</span>
          : <span className="text-ink-500">No warping plan yet</span>}
      </p>

      {yarnBlocker && (
        <div className="mt-3 rounded-lg bg-status-warningBg px-3 py-2 text-sm" role="alert">
          <p className="font-medium text-status-warning">Not completed — the yarn is still on the rack</p>
          <p className="mt-0.5 text-ink-600">{yarnBlocker}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to={`/warping/${id}`}><Button size="sm" variant="secondary">Issue the batch</Button></Link>
            <Button size="sm" variant="ghost" onClick={() => setForceOpen(true)}>Complete anyway…</Button>
            <Button size="sm" variant="ghost" onClick={() => setYarnBlocker(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      {can && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {hasPlan ? (
            <Link to={`/warping/${id}#plan`}>
              <Button size="sm" variant="secondary"><Eye className="h-4 w-4" aria-hidden /> View warping plan</Button>
            </Link>
          ) : stage.status === "open" && !jobClosed ? (
            <Link to={`/warping/${id}?plan=create#plan`}>
              <Button size="sm" variant="secondary"><Plus className="h-4 w-4" aria-hidden /> Create warping plan</Button>
            </Link>
          ) : null}
          {active && stage.status === "open" && (
            <Button
              size="sm"
              onClick={runStart}
              loading={start.isPending}
              disabled={!hasPlan}
              title={hasPlan ? "Start the warping" : "Create a warping plan before starting"}
            >
              <Play className="h-4 w-4" aria-hidden /> Start warping
            </Button>
          )}
          {active && stage.status === "in_progress" && (
            <Button size="sm" onClick={() => runComplete()} loading={complete.isPending}>
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Complete warping
            </Button>
          )}
        </div>
      )}

      <ReasonDialog
        open={forceOpen}
        onClose={() => setForceOpen(false)}
        title="Complete without issuing the yarn"
        description="For beams already off the machine — warping that ran before the yarn was recorded against a batch. The reason is kept on the job's audit trail."
        confirmLabel="Complete anyway"
        minLength={5}
        loading={complete.isPending}
        onConfirm={(reason) => { runComplete(reason); setForceOpen(false); }}
      />
    </section>
  );
}

function CoveringBlock({ stage, canOpen, jobClosed }: { stage: Job["covering"]; canOpen: boolean; jobClosed: boolean }) {
  const [adding, setAdding] = useState(false);
  if (!stage) return <Missing name="Covering" />;
  const id = stage._id;
  const can = canOpen && !!id;
  const beams = stage.beamEntries ?? [];
  const total = stage.producedWeight ?? beams.reduce((s, b) => s + (b.weight || 0), 0);
  const editable = !jobClosed && (stage.status === "open" || stage.status === "in_progress");
  const nextBeam = beams.reduce((m, b) => Math.max(m, b.beamNo || 0), 0) + 1;

  return (
    <section className="rounded-xl border border-ink-200 p-4" aria-label="Covering">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">
          {can ? (
            <Link to={`/covering/${id}`} className="inline-flex items-center gap-1 hover:underline">
              Covering <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : "Covering"}
        </h4>
        {stageChip(stage.status)}
      </div>

      <p className="mt-2 flex items-center gap-2 text-sm">
        <Scale className="h-4 w-4 text-ink-400" aria-hidden />
        {beams.length
          ? <span>{beams.length} beam{beams.length === 1 ? "" : "s"} weighed · {kg(total)} kg</span>
          : <span className="text-ink-500">No beams weighed yet</span>}
      </p>
      {beams.length > 0 && (
        <p className="mt-1 text-xs text-ink-400">
          {beams.slice(-4).map((b) => `Beam ${b.beamNo}: ${kg(b.weight)} kg`).join(" · ")}
          {beams.length > 4 ? " …" : ""}
        </p>
      )}

      {can && (editable || beams.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {editable && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Add covering beam
            </Button>
          )}
          {/* The filled programme, photographed: read on the covering page. */}
          {editable && (
            <Link
              to={`/covering/${id}?sheet=read`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium hover:border-ink-400"
            >
              <ScanText className="h-4 w-4" aria-hidden /> Read beam sheet
            </Link>
          )}
          {beams.length > 0 && (
            <a
              href={coveringService.beamLabelsPdfUrl(id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium hover:border-ink-400"
            >
              <Printer className="h-4 w-4" aria-hidden /> Beam labels
            </a>
          )}
        </div>
      )}

      {adding && id && (
        <AddBeam coveringId={id} nextBeam={nextBeam} taken={beams.map((b) => b.beamNo)} onClose={() => setAdding(false)} />
      )}
    </section>
  );
}

/** One beam's weight, entered from the job. */
function AddBeam({ coveringId, nextBeam, taken, onClose }: {
  coveringId: string;
  nextBeam: number;
  taken: number[];
  onClose: () => void;
}) {
  const { addBeam } = useCoveringMutations();
  const { toast } = useToast();
  const [beamNo, setBeamNo] = useState(String(nextBeam));
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const no = parseInt(beamNo, 10);
    const w = parseFloat(weight);
    if (!Number.isFinite(no) || no <= 0) return setError("Enter the beam number.");
    if (taken.includes(no)) return setError(`Beam ${no} is weighed already.`);
    if (!Number.isFinite(w) || w <= 0) return setError("Enter the weight in kg.");
    addBeam.mutate(
      { id: coveringId, beamNo: no, weight: w, note: note.trim() || undefined },
      {
        onSuccess: () => { toast(`Beam ${no} added — ${kg(w)} kg`, "success"); onClose(); },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not add the beam."),
      }
    );
  };

  return (
    <Modal open onClose={onClose} title="Add covering beam" width="max-w-sm">
      <form onSubmit={save} noValidate className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Beam #" type="number" min={1} value={beamNo} onChange={(e) => setBeamNo(e.target.value)} />
          <Input label="Weight (kg)" type="number" step="0.01" min={0} value={weight} onChange={(e) => setWeight(e.target.value)} autoFocus />
        </div>
        <Input label="Note" placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={addBeam.isPending}>Add beam</Button>
        </div>
      </form>
    </Modal>
  );
}
