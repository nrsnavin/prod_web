import { PrintModal } from "@/components/print/PrintModal";
import { QrImg } from "@/components/print/QrImg";
import { BeamEntry, Covering } from "./types";
import { elasticLineName } from "./programmeShared";

function fmtKg(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function enteredByName(by: BeamEntry["enteredBy"]): string | null {
  if (by && typeof by === "object") return by.name ?? null;
  return null;
}

// Covering beam labels — one card per recorded beam entry, showing the
// beam number and its weight (kg) rather than the planned meters, mirroring
// the Flutter covering beam label. The elastic name is the first planned
// line on the covering.
export function CoveringLabels({
  open,
  onClose,
  covering,
}: {
  open: boolean;
  onClose: () => void;
  covering: Covering;
}) {
  const jobNo = covering.job?.jobOrderNo ?? "—";
  const firstElastic = covering.elasticPlanned?.[0];
  const elasticName = firstElastic ? elasticLineName(firstElastic) : "";
  const entries = covering.beamEntries ?? [];

  return (
    <PrintModal open={open} onClose={onClose} title="Covering beam labels">
      <div className="space-y-3">
        {entries.map((entry) => {
          const by = enteredByName(entry.enteredBy);
          return (
            <div key={entry._id} className="print-label border-2 border-ink-900 rounded-sm p-3">
              <div className="flex justify-between text-sm font-bold border-b border-ink-200 pb-1.5">
                <span>COVERING BEAM · JOB J-{jobNo}</span>
                <span>{covering.job?.customer?.name ?? ""}</span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="flex items-end gap-3">
                  <div className="text-center">
                    <p className="text-[10px] font-bold tracking-wide text-ink-400">BEAM</p>
                    <p className="text-3xl font-black leading-none tabular-nums">{entry.beamNo}</p>
                  </div>
                  <div>
                    {elasticName && (
                      <p className="text-base font-black leading-tight">{elasticName}</p>
                    )}
                    <p className="text-xs text-ink-600 mt-0.5">
                      {entry.enteredAt ? new Date(entry.enteredAt).toLocaleDateString() : ""}
                      {by ? ` · By ${by}` : ""}
                    </p>
                  </div>
                </div>
                <p className="text-2xl font-black tabular-nums whitespace-nowrap">
                  {fmtKg(entry.weight)} <span className="text-sm font-bold">kg</span>
                </p>
                <QrImg value={`COVB|J:${jobNo}|C:${covering._id}|B:${entry.beamNo}|E:${entry._id}`} size={52} />
              </div>
            </div>
          );
        })}
        {entries.length === 0 && (
          <p className="text-sm text-ink-400">
            No beams recorded yet. Add beam entries to print weight labels.
          </p>
        )}
      </div>
    </PrintModal>
  );
}
