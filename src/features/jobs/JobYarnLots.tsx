import { Link } from "react-router-dom";
import { Layers } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useJobYarnLots } from "./hooks";

/**
 * Which dye lots went into this job, grouped by the elastic they were
 * warped for.
 *
 * This is the direction the question actually gets asked from. A customer
 * reports a shade band, quotes the job number off the packing list, and
 * someone has to say which lot is in the goods — months after the beam
 * came off the machine and possibly after the lot itself is long gone.
 * The batch snapshots its lot numbers at issue time, so this answer
 * survives the lot record.
 *
 * Cancelled batches are absent: their yarn went back on the rack, so it
 * is not in the goods.
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

  return (
    <Card className="mt-4">
      <div className="px-5 pt-5">
        <h3 className="font-semibold">Yarn lots used</h3>
        <p className="text-xs text-ink-400">
          The dye lots warped into this job, so a shade query can be traced back to
          the bag. Cancelled batches are excluded — that yarn went back on the rack.
        </p>
      </div>

      {!anyLots ? (
        <EmptyState
          title="No lots recorded"
          description="Lots appear here once a warping batch is created against this job."
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
                    <li key={`${l.batchId}-${l.yarnLot}-${i}`} className="text-sm">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <Link
                          to={`/materials`}
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {l.lotNo || "—"}
                        </Link>
                        {l.shade && <span className="text-xs text-ink-400">{l.shade}</span>}
                        <span className="text-xs text-ink-600">{l.materialName}</span>
                        <span className="ml-auto tabular-nums text-ink-600">
                          {l.quantity.toLocaleString("en-IN")} kg
                        </span>
                      </div>
                      <p className="text-xs text-ink-400">
                        {l.batchNo}
                        {l.beamNos.length > 0 ? ` · beam ${l.beamNos.join(", ")}` : ""}
                        {l.issuedDate
                          ? ` · issued ${new Date(l.issuedDate).toLocaleDateString()}`
                          : " · not yet issued"}
                        {/* The batch drew this yarn once, not once per
                            elastic — dividing it would invent a figure. */}
                        {l.sharedAcross > 1
                          ? ` · shared across ${l.sharedAcross} elastics`
                          : ""}
                      </p>
                    </li>
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
