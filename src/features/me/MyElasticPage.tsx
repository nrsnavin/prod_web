import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useMyElastic } from "./hooks";
import { ElasticSpec, MaterialRef } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE ELASTIC, IN DEPTH — what the operator needs at the loom
//
//  Construction, the yarns on each beam, the test limits it must pass,
//  and the warping plan. No price or cost: the server sends none, and
//  only for an elastic on this worker's own loom.
// ══════════════════════════════════════════════════════════════════

const dash = (v: number | string | null | undefined, unit = "") =>
  v === null || v === undefined || v === "" ? "—" : `${typeof v === "number" ? v.toLocaleString("en-IN") : v}${unit}`;
const matName = (m: MaterialRef | null | undefined) => m?.name ?? "—";

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-canvas px-3 py-2.5">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function materialRows(e: ElasticSpec) {
  const rows: Array<{ part: string; material: string; ends: string; weight: string }> = [];
  if (e.warpSpandex) rows.push({ part: "Warp spandex", material: matName(e.warpSpandex.material), ends: dash(e.warpSpandex.ends), weight: dash(e.warpSpandex.weight, " g") });
  e.warpYarn.forEach((y, i) =>
    rows.push({ part: e.warpYarn.length > 1 ? `Warp yarn ${i + 1}` : "Warp yarn", material: matName(y.material), ends: dash(y.ends), weight: dash(y.weight, " g") })
  );
  if (e.spandexCovering) rows.push({ part: "Spandex covering", material: matName(e.spandexCovering.material), ends: "—", weight: dash(e.spandexCovering.weight, " g") });
  if (e.weftYarn) rows.push({ part: "Weft yarn", material: matName(e.weftYarn.material), ends: "—", weight: dash(e.weftYarn.weight, " g") });
  return rows.filter((r) => r.material !== "—" || r.ends !== "—" || r.weight !== "—");
}

export function MyElasticPage() {
  const { id } = useParams();
  const q = useMyElastic(id);
  const e = q.data;

  return (
    <>
      <Link to="/my/shift" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> My shift
      </Link>
      {q.isLoading ? (
        <Skeleton className="h-80 w-full rounded-card" />
      ) : q.isError || !e ? (
        <Card>
          <ErrorState error={q.error} what="this elastic" onRetry={() => q.refetch()} />
        </Card>
      ) : (
        <>
          <PageHeader title={e.name} subtitle={`Weave ${e.weaveType}`} />
          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="font-semibold">Construction</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Spec label="Hooks" value={dash(e.hooks)} />
                <Spec label="Pick" value={dash(e.pick)} />
                <Spec label="Weight" value={dash(e.weightPerMetre, " g/m")} />
                <Spec label="Spandex ends" value={dash(e.spandexEnds)} />
                <Spec label="Yarn ends" value={dash(e.yarnEnds)} />
                <Spec label="Weave" value={dash(e.weaveType)} />
              </div>
            </Card>

            <Card>
              <h2 className="px-5 pt-5 font-semibold">Yarns</h2>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-ink-400">
                    <tr>
                      <th className="px-5 py-2 text-left font-semibold">Part</th>
                      <th className="px-3 py-2 text-left font-semibold">Material</th>
                      <th className="px-3 py-2 text-right font-semibold">Ends</th>
                      <th className="px-5 py-2 text-right font-semibold">Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {materialRows(e).map((r) => (
                      <tr key={r.part}>
                        <td className="px-5 py-2.5 text-ink-500">{r.part}</td>
                        <td className="px-3 py-2.5 font-medium">{r.material}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.ends}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">{r.weight}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {e.testing && (
              <Card className="p-5">
                <h2 className="font-semibold">Test limits</h2>
                <p className="mt-0.5 text-xs text-ink-500">What the finished elastic must pass in QC.</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Spec label="Width" value={dash(e.testing.width, " mm")} />
                  <Spec label="Elongation" value={dash(e.testing.elongation, "%")} />
                  <Spec label="Recovery" value={dash(e.testing.recovery, "%")} />
                  <Spec label="Stretch" value={dash(e.testing.stretch)} />
                </div>
              </Card>
            )}

            {e.warpingPlan?.beams && e.warpingPlan.beams.length > 0 && (
              <Card className="p-5">
                <h2 className="font-semibold">Warping plan</h2>
                <ul className="mt-3 divide-y divide-ink-100">
                  {e.warpingPlan.beams.map((b, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                      <span>Beam {b.beamNo ?? i + 1}</span>
                      <span className="tabular-nums text-ink-600">
                        {dash(b.totalEnds)} ends · {(b.sections ?? []).length} section{(b.sections ?? []).length === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </>
      )}
    </>
  );
}
