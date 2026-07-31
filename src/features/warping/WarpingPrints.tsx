import { PrintModal } from "@/components/print/PrintModal";
import {
  SheetHeader, SheetPane, SheetSection, SheetTable, SheetSignatures, Th, Td,
} from "@/components/print/SheetForm";
import { QrImg } from "@/components/print/QrImg";
import { Warping, WarpingPlan, WarpingPlanSection } from "./types";
import { elasticLineName } from "./programmeShared";

function yarnName(y: unknown): string {
  return typeof y === "object" && y !== null ? ((y as { name?: string }).name ?? "—") : "—";
}

/**
 * The dye lot this section runs off, as it should read on paper.
 *
 * The stored snapshot wins over the populated lot record: this sheet is
 * the copy that goes to the machine and gets filed, so it must still say
 * what it said on the day, even if the lot is later renumbered or gone.
 */
function sectionLot(sec: WarpingPlanSection): string {
  const lotNo =
    sec.lotNo ||
    (typeof sec.yarnLot === "object" && sec.yarnLot ? sec.yarnLot.lotNo : "");
  if (!lotNo) return "—";
  const shade =
    sec.shade ||
    (typeof sec.yarnLot === "object" && sec.yarnLot ? sec.yarnLot.shade : "");
  return shade ? `${lotNo} · ${shade}` : lotNo;
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
        <SheetHeader
          title="Warping Programme"
          subtitle="Beam build sheet for one job order"
          fields={[
            { label: "Job order", value: <strong>J-{jobNo}</strong> },
            { label: "Opened", value: warping.date ? new Date(warping.date).toLocaleDateString() : "—" },
            { label: "Status", value: <span className="capitalize">{warping.status.replace("_", " ")}</span> },
            { label: "Beams", value: plan ? plan.noOfBeams : "—" },
          ]}
        />

        <SheetPane label="Customer" className="mt-3">
          <strong>{warping.job?.customer?.name ?? "—"}</strong>
        </SheetPane>

        <SheetSection>Elastics</SheetSection>
        <SheetTable
          head={
            <tr>
              <Th>Elastic</Th>
              <Th align="right">Quantity (m)</Th>
            </tr>
          }
        >
          <tbody>
            {(warping.elasticOrdered ?? []).map((l, i) => (
              <tr key={i}>
                <Td>{elasticLineName(l)}</Td>
                <Td align="right">{l.quantity.toLocaleString("en-IN")}</Td>
              </tr>
            ))}
          </tbody>
        </SheetTable>

        <SheetSection>
          Beam plan {plan ? `— ${plan.noOfBeams} beam(s)` : "— not created"}
        </SheetSection>
        {plan &&
          plan.beams.map((beam, bi) => (
            <SheetTable
              key={bi}
              className="mb-2 print-label"
              head={
                <tr>
                  <Th colSpan={2}>
                    Beam {beam.beamNo ?? bi + 1}
                    {beam.totalEnds ? ` — ${beam.totalEnds} total ends` : ""}
                    {beam.pairedBeamNo ? ` · run with beam ${beam.pairedBeamNo}` : ""}
                  </Th>
                  {/* The lot is the instruction the warper acts on: pull
                      this section off this bag, not whatever is nearest. */}
                  <Th>Dye lot</Th>
                  <Th align="right">Ends</Th>
                  <Th align="right">Length (m)</Th>
                </tr>
              }
            >
              <tbody>
                {beam.sections.map((sec, si) => (
                  <tr key={si}>
                    <Td className="w-8 text-ink-600">{si + 1}</Td>
                    <Td>{yarnName(sec.warpYarn)}</Td>
                    <Td>{sectionLot(sec)}</Td>
                    <Td align="right">{sec.ends}</Td>
                    <Td align="right">{sec.maxMeters ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </SheetTable>
          ))}

        {plan?.remarks && (
          <SheetPane label="Remarks" className="mt-3">
            {plan.remarks}
          </SheetPane>
        )}

        <SheetSignatures labels={["Warper", "Supervisor", "Checked by"]} />
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
                    {sectionLot(s) !== "—" && (
                      <span className="text-ink-600"> · lot {sectionLot(s)}</span>
                    )}
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
