import { Link } from "react-router-dom";
import { Activity, Wrench, CircleDot } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/cn";
import { sortByNatural } from "@/components/ui/naturalOrder";
import { Machine, MachineStatus } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE FLOOR, AT A GLANCE
//
//  The machine list answers "tell me about machine X". It is bad at the
//  question people actually walk up to the screen with, which is "what
//  is running right now, and what is not". A table of forty rows with a
//  status chip in the sixth column makes somebody count.
//
//  So the floor comes first, as tiles, one per loom, grouped by what
//  the loom is doing. Running looms are the loudest thing on the page
//  because they are the thing that earns; idle ones are quiet but
//  present, because an idle loom is the thing you want to notice.
//
//  ── Colour is never the only signal ──────────────────────────────
//  Every tile carries an icon and a word as well as a tint. A green
//  square and an amber square are the same square to a colour-blind
//  reader, and this is a screen somebody scans in a hurry.
//
//  ── Why tiles and not a denser table ─────────────────────────────
//  Because the question is spatial. A floor of looms has a shape, and
//  the eye finds "three amber together" in a grid far faster than it
//  finds three rows scattered down a sorted list.
// ══════════════════════════════════════════════════════════════════

const TONE: Record<MachineStatus, { tile: string; dot: string; label: string }> = {
  running:     { tile: "border-status-success/40 bg-status-successBg",
                 dot: "text-status-success", label: "Running" },
  free:        { tile: "border-ink-200 bg-surface",
                 dot: "text-ink-400", label: "Idle" },
  maintenance: { tile: "border-status-warning/40 bg-status-warningBg",
                 dot: "text-status-warning", label: "Maintenance" },
};

const ICON: Record<MachineStatus, typeof Activity> = {
  running: Activity,
  free: CircleDot,
  maintenance: Wrench,
};

/** The job number on a loom, or null when it is not running one. */
export function runningJobOf(m: Machine): string | null {
  const job = m.orderRunning;
  if (!job || typeof job !== "object") return null;
  return job.jobOrderNo == null ? null : String(job.jobOrderNo);
}

function Tile({ machine }: { machine: Machine }) {
  const tone = TONE[machine.status] ?? TONE.free;
  const Icon = ICON[machine.status] ?? CircleDot;
  const job = runningJobOf(machine);

  return (
    <Link
      to={`/machines/${machine._id}`}
      className={cn(
        "group relative flex flex-col gap-1 rounded-lg border p-3 transition-colors",
        "hover:border-brand-500 focus-visible:outline focus-visible:outline-2",
        "focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        tone.tile
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold text-ink-900">{machine.ID}</span>
        <Icon className={cn("h-4 w-4 shrink-0", tone.dot)} aria-hidden />
      </div>

      {/* The word, not only the colour. */}
      <span className="text-xs text-ink-500">{tone.label}</span>

      {/* A running loom's job number is the one extra fact worth the
          space — it is what somebody is looking for when they scan. */}
      <span className="text-xs tabular-nums text-ink-400">
        {job ? `J-${job}` : `${machine.NoOfHead} heads`}
      </span>
    </Link>
  );
}

function Group({
  title, machines, hint,
}: {
  title: string;
  machines: Machine[];
  hint?: string;
}) {
  if (machines.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        <span className="text-xs tabular-nums text-ink-400">{machines.length}</span>
        {hint && <span className="text-xs text-ink-400">· {hint}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {machines.map((m) => <Tile key={m._id} machine={m} />)}
      </div>
    </div>
  );
}

export function FloorBoard({
  machines, loading,
}: {
  machines: Machine[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }

  // Every group in machine order. Without this the tiles come out in
  // whatever order the server returned them, which is the same problem
  // the table had — and worse here, because a grid gives no other clue
  // where to look for LOOM-7. Same comparator as the table, so the two
  // views never disagree about where LOOM-10 goes.
  const inOrder = (status: MachineStatus) =>
    sortByNatural(machines.filter((m) => m.status === status), (m) => m.ID);

  const running = inOrder("running");
  const maintenance = inOrder("maintenance");
  const idle = inOrder("free");

  const total = machines.length || 1;
  const runningPct = Math.round((running.length / total) * 100);

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
          The floor right now
        </h2>
        <p className="text-sm text-ink-500">
          <span className="text-lg font-bold tabular-nums text-ink-900">
            {running.length}
          </span>
          {" of "}
          <span className="tabular-nums">{machines.length}</span>
          {" looms running"}
          <span className="ml-2 tabular-nums text-ink-400">({runningPct}%)</span>
        </p>
      </div>

      {/* One bar, three segments, in the order somebody reads them.
          Proportional so the shape of the floor is legible before any
          number is read. */}
      <div
        className="mb-5 flex h-2 overflow-hidden rounded-full bg-ink-100"
        role="img"
        aria-label={
          `${running.length} running, ${maintenance.length} in maintenance, ` +
          `${idle.length} idle`
        }
      >
        <div className="bg-status-success" style={{ width: `${(running.length / total) * 100}%` }} />
        <div className="bg-status-warning" style={{ width: `${(maintenance.length / total) * 100}%` }} />
        <div className="bg-ink-300" style={{ width: `${(idle.length / total) * 100}%` }} />
      </div>

      <div className="space-y-5">
        <Group title="Running" machines={running} hint="earning" />
        <Group title="In maintenance" machines={maintenance} hint="off the floor" />
        <Group title="Idle" machines={idle} hint="available to plan" />
      </div>
    </Card>
  );
}

export default FloorBoard;
