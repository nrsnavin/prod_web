import { PrintModal } from "@/components/print/PrintModal";
import { Covering, ElasticOrderedLine } from "./types";

// The detail endpoint populates each planned elastic with its composition,
// so the sheet can show spandex details like the Flutter covering PDF.
interface PopulatedElastic {
  _id: string;
  name: string;
  spandexEnds?: number;
  warpSpandex?: { id?: { name?: string } | string | null; weight?: number };
  spandexCovering?: { id?: { name?: string } | string | null; weight?: number };
}

function materialName(mw?: { id?: { name?: string } | string | null }): string {
  if (!mw?.id) return "—";
  return typeof mw.id === "object" ? (mw.id.name ?? "—") : "—";
}

function asPopulated(line: ElasticOrderedLine): PopulatedElastic | null {
  return typeof line.elastic === "object" && line.elastic
    ? (line.elastic as PopulatedElastic)
    : null;
}

// Total wt (g/m) = warp spandex weight + spandex covering weight;
// expected produce (kg) = qty × total wt ÷ 1000 — same as the Flutter PDF.
function totalWeight(el: PopulatedElastic | null): number {
  return (el?.warpSpandex?.weight ?? 0) + (el?.spandexCovering?.weight ?? 0);
}

export function CoveringProgrammeSheet({
  open,
  onClose,
  covering,
}: {
  open: boolean;
  onClose: () => void;
  covering: Covering;
}) {
  const lines = covering.elasticPlanned ?? [];
  const expectedTotalKg = lines.reduce(
    (s, l) => s + (l.quantity * totalWeight(asPopulated(l))) / 1000,
    0
  );

  return (
    <PrintModal open={open} onClose={onClose} title="Covering programme">
      <div className="text-ink-900">
        <div className="flex items-start justify-between border-b-2 border-ink-900 pb-3">
          <div>
            <h1 className="text-xl font-bold">COVERING PROGRAM</h1>
            <p className="text-sm">
              Job J-{covering.job?.jobOrderNo ?? "—"} · {covering.job?.customer?.name ?? ""}
            </p>
          </div>
          <div className="text-right text-sm">
            <p>Opened: {covering.date ? new Date(covering.date).toLocaleDateString() : "—"}</p>
            <p className="capitalize">Status: {covering.status.replace("_", " ")}</p>
          </div>
        </div>

        <h2 className="mt-4 text-sm font-bold uppercase tracking-wide">
          Elastics ({lines.length} items)
        </h2>
        <div className="overflow-x-auto">
          <table className="mt-1 w-full text-sm border border-ink-200">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-100/50 text-left">
                <th className="py-1.5 px-2">#</th>
                <th className="py-1.5 px-2">Elastic</th>
                <th className="py-1.5 px-2 text-right">Qty (m)</th>
                <th className="py-1.5 px-2">Warp spandex</th>
                <th className="py-1.5 px-2">Sp. covering</th>
                <th className="py-1.5 px-2 text-right">Sp. ends</th>
                <th className="py-1.5 px-2 text-right">Total wt (g/m)</th>
                <th className="py-1.5 px-2 text-right">Exp. produce (kg)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const el = asPopulated(line);
                const wt = totalWeight(el);
                return (
                  <tr key={i} className="border-b border-ink-100">
                    <td className="py-1.5 px-2 text-ink-400">{i + 1}</td>
                    <td className="py-1.5 px-2 font-medium">{el?.name ?? "—"}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {line.quantity.toLocaleString()}
                    </td>
                    <td className="py-1.5 px-2">{materialName(el?.warpSpandex)}</td>
                    <td className="py-1.5 px-2">{materialName(el?.spandexCovering)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {el?.spandexEnds ?? "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {wt > 0 ? wt.toFixed(2) : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {wt > 0 ? ((line.quantity * wt) / 1000).toFixed(2) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {expectedTotalKg > 0 && (
              <tfoot>
                <tr className="border-t border-ink-300 font-semibold">
                  <td className="py-1.5 px-2" colSpan={7}>
                    Expected covering weight (total)
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums">
                    {expectedTotalKg.toFixed(2)} kg
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {covering.remarks && <p className="mt-2 text-sm">Remarks: {covering.remarks}</p>}

        <div className="mt-10 grid grid-cols-2 gap-6 text-sm">
          <div className="border-t border-ink-400 pt-1">Covering operator</div>
          <div className="border-t border-ink-400 pt-1 text-right">Supervisor</div>
        </div>
      </div>
    </PrintModal>
  );
}
