import { Link } from "react-router-dom";
import { Layers } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useJobYarnLots } from "./hooks";
import type { JobLotUse } from "./types";

/**
 * Which dye lots this job's goods carry, grouped by the elastic they were
 * warped for.
 *
 * This is the direction the question actually gets asked from. A customer
 * reports a shade band, quotes the job number off the packing list, and
 * someone has to say which lot is in the goods — months after the beam
 * came off the machine and possibly after the lot itself is long gone.
 *
 * A lot enters twice and both are shown, labelled:
 *
 *   • PROGRAMMED — picked while writing the warping programme. This is
 *     usually days before anything moves, and it used to appear nowhere:
 *     the decision was made, saved and printed on the sheet at the
 *     machine while this panel still said "no lots recorded".
 *   • ISSUED — drawn against a warping batch, with a weight. Cancelled
 *     batches are absent; their yarn went back on the rack.
 *
 * They are never added together. One is an intention that can still
 * change, the other is yarn that has already left the rack.
 */
export function JobYarnLots({ jobId }: { jobId: string }) {
  const { data, isLoading } = useJobYarnLots(jobId);

  if (isLoading) {
    return (
      <Card className="mt-4 p-5">
        <h3 className="font-semibold">Yarn lots used</h3>
        <Skeleton className="mt-3 h-20 w-full" />
      </Card>
    );
  }
  if (!data) return null;

  const anyLots = data.byElastic.some((g) => g.lots.length > 0);
  const open = data.sections?.open ?? 0;

  return (
    <Card className="mt-4">
      <div className="px-5 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">Yarn lots used</h3>
          {open > 0 && (
            <StatusChip tone="warning">
              {open} section{open === 1 ? "" : "s"} open
            </StatusChip>
          )}
        </div>
        <p className="text-xs text-ink-400">
          The dye lots warped into this job, so a shade query can be traced back to
          the bag. Programmed lots are what the sheet says to run; issued ones have
          come off the rack. Cancelled batches are excluded.
        </p>
        {open > 0 && (
          <p className="mt-1 text-xs text-ink-500">
            {/* An open section is not a fault — an undyed yarn has no lot, and
                a programme can be written before the lot is decided. Saying
                which beams lets someone close it without hunting. */}
            No lot chosen yet on{" "}
            {data.openBeamNos.length > 0
              ? `beam ${data.openBeamNos.join(", ")}`
              : "some sections"}
            . That is allowed — undyed yarn has no lot — but the choice is still open.
          </p>
        )}
      </div>

      {!anyLots ? (
        <EmptyState
          title="No lots recorded"
          description="Lots appear here once one is chosen in the warping programme, or a warping batch is issued against this job."
          icon={<Layers className="h-6 w-6" />}
        />
      ) : (
        <div className="mt-3 divide-y divide-ink-100">
          {data.byElastic.map((g) => (
            <div key={g.elasticId ?? "unattributed"} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{g.elasticName}</span>
                {/* An unattributed batch is not "all elastics" — say which
                    it is, so nobody reads the gap as a fact. */}
                {g.elasticId === null && (
                  <StatusChip tone="warning">not pinned to an elastic</StatusChip>
                )}
              </div>

              {g.lots.length === 0 ? (
                <p className="mt-1 text-xs text-ink-400">Nothing recorded for this elastic.</p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {g.lots.map((l, i) => (
                    <LotRow key={`${l.source}-${l.batchId ?? l.planId}-${l.yarnLot}-${i}`} lot={l} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function LotRow({ lot: l }: { lot: JobLotUse }) {
  const planned = l.source === "planned";
  return (
    <li className="text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Link to="/materials" className="font-medium text-brand-600 hover:underline">
          {l.lotNo || "—"}
        </Link>
        {l.shade && <span className="text-xs text-ink-400">{l.shade}</span>}
        <span className="text-xs text-ink-600">{l.materialName}</span>
        <StatusChip tone={planned ? "neutral" : "success"}>
          {planned ? "programmed" : "issued"}
        </StatusChip>
        {/* A lot quarantined after it was programmed is the one thing on
            this panel somebody has to act on before the beam is built. */}
        {l.lotStatus === "quarantined" && <StatusChip tone="danger">quarantined</StatusChip>}
        <span className="ml-auto tabular-nums text-ink-600">
          {/* Programming names the lot, it does not weigh it. A kilogram
              figure here would be invented, and it would be believed. */}
          {l.quantity == null ? "—" : `${l.quantity.toLocaleString("en-IN")} kg`}
        </span>
      </div>
      <p className="text-xs text-ink-400">
        {planned
          ? `Warping programme${l.sections ? ` · ${l.sections} section${l.sections === 1 ? "" : "s"}` : ""}`
          : l.batchNo}
        {l.beamNos.length > 0 ? ` · beam ${l.beamNos.join(", ")}` : ""}
        {!planned &&
          (l.issuedDate
            ? ` · issued ${new Date(l.issuedDate).toLocaleDateString()}`
            : " · not yet issued")}
        {/* The batch drew this yarn once, not once per elastic —
            dividing it would invent a figure. */}
        {l.sharedAcross > 1 ? ` · shared across ${l.sharedAcross} elastics` : ""}
      </p>
    </li>
  );
}
