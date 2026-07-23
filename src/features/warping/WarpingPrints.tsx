import { PrintModal } from "@/components/print/PrintModal";
import { QrImg } from "@/components/print/QrImg";
import { Warping, WarpingPlan } from "./types";
import { elasticLineName } from "./programmeShared";

function yarnName(y: unknown): string {
  return typeof y === "object" && y !== null ? ((y as { name?: string }).name ?? "—") : "—";
}

// ── Warping programme sheet (A4) ────────────────────────────────────────
export function WarpingProgrammeSheet({
  open,
  onClose,
  warping,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  warping: Warping;
  plan?: WarpingPlan;
}) {
  const jobNo = warping.job?.jobOrderNo ?? "—";
  return (
    <PrintModal open={open} onClose={onClose} title="Warping programme">
      <div className="text-ink-900">
        <div className="flex items-start justify-between border-b-2 border-ink-900 pb-3">
          <div>
            <h1 className="text-xl font-bold">WARPING PROGRAMME</h1>
            <p className="text-sm">Job J-{jobNo} · {warping.job?.customer?.name ?? ""}</p>
          </div>
          <div className="text-right text-sm">
            <p>Opened: {warping.date ? new Date(warping.date).toLocaleDateString() : "—"}</p>
            <p className="capitalize">Status: {warping.status.replace("_", " ")}</p>
          </div>
        </div>

        <h2 className="mt-4 text-sm font-bold uppercase tracking-wide">Elastics</h2>
        <table className="mt-1 w-full text-sm border border-ink-200">
          <thead>
            <tr className="border-b border-ink-200 bg-ink-100/50">
              <th className="py-1.5 px-2 text-left">Elastic</th>
              <th className="py-1.5 px-2 text-right">Quantity (m)</th>
            </tr>
          </thead>
          <tbody>
            {(warping.elasticOrdered ?? []).map((l, i) => (
              <tr key={i} className="border-b border-ink-100">
                <td className="py-1.5 px-2 font-medium">{elasticLineName(l)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">
                  {l.quantity.toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-4 text-sm font-bold uppercase tracking-wide">
          Beam plan {plan ? `(${plan.noOfBeams} beams)` : "(not created)"}
        </h2>
        {plan &&
          plan.beams.map((beam, bi) => (
            <table key={bi} className="mt-2 w-full text-sm border border-ink-200 print-label">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-100/50">
                  <th className="py-1.5 px-2 text-left" colSpan={2}>
                    Beam {beam.beamNo ?? bi + 1}
                    {beam.totalEnds ? ` — ${beam.totalEnds} total ends` : ""}
                  </th>
                  <th className="py-1.5 px-2 text-right">Ends</th>
                  <th className="py-1.5 px-2 text-right">Length (m)</th>
                </tr>
              </thead>
              <tbody>
                {beam.sections.map((s, si) => (
                  <tr key={si} className="border-b border-ink-100">
                    <td className="py-1.5 px-2 w-10 text-ink-400">#{si + 1}</td>
                    <td className="py-1.5 px-2 font-medium">{yarnName(s.warpYarn)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{s.ends}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{s.maxMeters ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        {plan?.remarks && <p className="mt-2 text-sm">Remarks: {plan.remarks}</p>}

        <div className="mt-10 grid grid-cols-2 gap-6 text-sm">
          <div className="border-t border-ink-400 pt-1">Warper's signature</div>
          <div className="border-t border-ink-400 pt-1 text-right">Supervisor</div>
        </div>
      </div>
    </PrintModal>
  );
}

// ── Beam labels — one card per beam, mirrors the Flutter beam label ─────
export function BeamLabels({
  open,
  onClose,
  warping,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  warping: Warping;
  plan?: WarpingPlan;
}) {
  const jobNo = warping.job?.jobOrderNo ?? "—";
  return (
    <PrintModal open={open} onClose={onClose} title="Beam labels">
      <div className="space-y-3">
        {(plan?.beams ?? []).map((beam, bi) => (
          <div
            key={bi}
            className="print-label flex border-2 border-ink-900 rounded-sm overflow-hidden"
          >
            {/* Beam number column */}
            <div className="w-16 shrink-0 border-r border-ink-900 grid place-items-center bg-ink-100/40">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wide">Beam</p>
                <p className="text-3xl font-black leading-none">{beam.beamNo ?? bi + 1}</p>
              </div>
            </div>
            <div className="flex-1 p-3">
              <div className="flex justify-between text-sm font-bold border-b border-ink-200 pb-1.5">
                <span>JOB J-{jobNo}</span>
                <span>{warping.job?.customer?.name ?? ""}</span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {beam.sections.map((s, si) => (
                  <p key={si} className="truncate">
                    <span className="font-medium">{yarnName(s.warpYarn)}</span>
                    <span className="text-ink-600"> · {s.ends} ends</span>
                  </p>
                ))}
                <p className="text-ink-600">
                  Total ends: <span className="font-bold text-ink-900">{beam.totalEnds ?? "—"}</span>
                </p>
                <p className="text-ink-600">
                  Date: {warping.date ? new Date(warping.date).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
            <div className="shrink-0 self-center pr-3">
              <QrImg value={`WARP|J:${jobNo}|B:${beam.beamNo ?? bi + 1}|W:${warping._id}`} size={56} />
            </div>
          </div>
        ))}
        {(plan?.beams.length ?? 0) === 0 && (
          <p className="text-sm text-ink-400">No beam plan created yet.</p>
        )}
      </div>
    </PrintModal>
  );
}
