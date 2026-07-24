import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { PrintModal } from "@/components/print/PrintModal";
import { QrImg } from "@/components/print/QrImg";
import { cn } from "@/components/ui/cn";
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
// line on the covering. Each label can be printed individually (its own
// Print button), or all at once via the modal's Print action.
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

  // When set, only the matching label prints (the print CSS hides the rest
  // while `data-print-solo` is present). Cleared right after printing.
  const [soloId, setSoloId] = useState<string | null>(null);
  useEffect(() => {
    if (!soloId) return;
    // Defer to the next tick so the solo data-attrs are in the DOM before
    // the print dialog snapshots the page.
    const t = setTimeout(() => {
      window.print();
      setSoloId(null);
    }, 0);
    return () => clearTimeout(t);
  }, [soloId]);

  return (
    <PrintModal open={open} onClose={onClose} title="Covering beam labels">
      <div className="space-y-3" data-print-solo={soloId ? "" : undefined}>
        {entries.map((entry) => {
          const by = enteredByName(entry.enteredBy);
          return (
            <div
              key={entry._id}
              className={cn(
                "print-label relative border-2 border-ink-900 rounded-sm p-3",
                soloId === entry._id && "print-solo-target"
              )}
            >
              <button
                type="button"
                onClick={() => setSoloId(entry._id)}
                className="print:hidden absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-xs font-medium text-ink-600 hover:border-ink-400"
                aria-label={`Print beam ${entry.beamNo} label`}
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
              <div className="flex justify-between text-sm font-bold border-b border-ink-200 pb-1.5 pr-16">
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
