import { PrintModal } from "@/components/print/PrintModal";
import { QrImg } from "@/components/print/QrImg";
import { Covering } from "./types";
import { elasticLineName } from "./programmeShared";

// Covering labels — one card per planned elastic, mirroring the Flutter
// covering beam label (job, elastic, qty, date).
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
  return (
    <PrintModal open={open} onClose={onClose} title="Covering labels">
      <div className="space-y-3">
        {(covering.elasticPlanned ?? []).map((line, i) => (
          <div key={i} className="print-label border-2 border-ink-900 rounded-sm p-3">
            <div className="flex justify-between text-sm font-bold border-b border-ink-200 pb-1.5">
              <span>COVERING · JOB J-{jobNo}</span>
              <span>{covering.job?.customer?.name ?? ""}</span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-lg font-black leading-tight">{elasticLineName(line)}</p>
                <p className="text-sm text-ink-600 mt-0.5">
                  Date: {covering.date ? new Date(covering.date).toLocaleDateString() : "—"}
                </p>
              </div>
              <p className="text-2xl font-black tabular-nums">
                {line.quantity.toLocaleString("en-IN")} <span className="text-sm font-bold">m</span>
              </p>
              <QrImg value={`COV|J:${jobNo}|C:${covering._id}|I:${i}`} size={52} />
            </div>
          </div>
        ))}
        {(covering.elasticPlanned?.length ?? 0) === 0 && (
          <p className="text-sm text-ink-400">No elastics planned on this covering.</p>
        )}
      </div>
    </PrintModal>
  );
}
