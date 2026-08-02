import { Link } from "react-router-dom";
import { Layers } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useOrderYarnLots } from "./hooks";
import type { OrderLotRow } from "./types";

/**
 * The dye lots this order's goods will carry.
 *
 * A shade complaint arrives quoting an order number or a delivery note —
 * never a warping batch — so the trail has to be answerable from this
 * end. Each job on the order contributes twice: the lots its warping
 * programme committed to, and the lots its batches actually issued.
 *
 * The two are shown side by side and never added. A programmed lot can
 * still be changed; an issued one has left the rack. Reporting them as
 * one figure would make an intention look like a fact.
 *
 * Sections with no lot yet are counted rather than hidden. An order two
 * beams short of a decision otherwise looks exactly like a settled one.
 */
export function OrderYarnLots({ orderId }: { orderId: string }) {
  const { data, isLoading } = useOrderYarnLots(orderId);

  if (isLoading) {
    return (
      <Card className="mt-4 p-5">
        <h3 className="font-semibold">Dye lots</h3>
        <Skeleton className="mt-3 h-24 w-full" />
      </Card>
    );
  }
  if (!data) return null;

  const open = data.sections?.open ?? 0;
  // A programme written but left without lots has something to say — it
  // is the state someone has to close before the beam is built. Falling
  // to the empty card there would hide exactly the case worth showing.
  const anything = data.byJob.some(
    (j) => j.planned.length > 0 || j.issued.length > 0 || j.sections.total > 0
  );

  return (
    <Card className="mt-4">
      <div className="px-5 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">Dye lots</h3>
          {data.lots.length > 0 && (
            <StatusChip tone="info">
              {data.lots.length} lot{data.lots.length === 1 ? "" : "s"}
            </StatusChip>
          )}
          {open > 0 && (
            <StatusChip tone="warning">
              {open} section{open === 1 ? "" : "s"} open
            </StatusChip>
          )}
        </div>
        <p className="text-xs text-ink-400">
          Which lots the jobs on this order are warped from — chosen in the warping
          programme, then drawn against a batch. Traced from here so a shade query
          quoting the order number can be answered without hunting through jobs.
        </p>
      </div>

      {!anything ? (
        <EmptyState
          title="No lots yet"
          description="Lots appear here once a warping programme on one of this order's jobs names one."
          icon={<Layers className="h-6 w-6" />}
        />
      ) : (
        <div className="mt-3 divide-y divide-ink-100">
          {data.byJob.map((j) => (
            <div key={j.jobId} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/jobs/${j.jobId}`}
                  className="text-sm font-medium text-brand-600 hover:underline"
                >
                  {j.jobNo}
                </Link>
                <StatusChip tone="neutral">{j.status}</StatusChip>
                {j.elastics.length > 0 && (
                  <span className="text-xs text-ink-500">{j.elastics.join(", ")}</span>
                )}
                {j.sections.open > 0 && (
                  <span className="text-xs text-status-warning">
                    {j.sections.open} open
                    {j.openBeamNos.length > 0 ? ` (beam ${j.openBeamNos.join(", ")})` : ""}
                  </span>
                )}
              </div>

              {j.planned.length === 0 && j.issued.length === 0 ? (
                <p className="mt-1 text-xs text-ink-400">
                  {/* "No lots on this job" and "no programme yet" are
                      different answers and only one of them is true. */}
                  {j.sections.total === 0
                    ? "No warping programme written yet."
                    : "Programme written, no lot chosen on any section."}
                </p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {[...j.planned, ...j.issued].map((l, i) => (
                    <LotLine key={`${l.source}-${l.yarnLot ?? l.lotNo}-${i}`} lot={l} />
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

function LotLine({ lot: l }: { lot: OrderLotRow }) {
  const planned = l.source === "planned";
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="font-medium">{l.lotNo || "—"}</span>
      {l.shade && <span className="text-xs text-ink-400">{l.shade}</span>}
      <span className="text-xs text-ink-600">{l.materialName}</span>
      <StatusChip tone={planned ? "neutral" : "success"}>
        {planned ? "programmed" : "issued"}
      </StatusChip>
      {l.lotStatus === "quarantined" && <StatusChip tone="danger">quarantined</StatusChip>}
      <span className="text-xs text-ink-400">
        {l.beamNos.length > 0 ? `beam ${l.beamNos.join(", ")}` : ""}
        {planned && l.sections ? ` · ${l.sections} section${l.sections === 1 ? "" : "s"}` : ""}
        {!planned && l.batchNo ? ` · ${l.batchNo}` : ""}
      </span>
      <span className="ml-auto tabular-nums text-ink-600">
        {/* Programming names a lot; it does not weigh it. */}
        {planned || l.quantity == null ? "—" : `${l.quantity.toLocaleString("en-IN")} kg`}
      </span>
    </li>
  );
}
