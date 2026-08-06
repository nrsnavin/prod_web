import { PrintModal } from "@/components/print/PrintModal";
import {
  SheetHeader, SheetPane, SheetSection, SheetTable, SheetSignatures, Th, Td,
} from "@/components/print/SheetForm";
import { BeamEntry, Covering, ElasticOrderedLine } from "./types";

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

// ── Beam weights ────────────────────────────────────────────────────────
//
// The programme goes to the machine before a single beam exists, so the
// sheet carries a fixed grid of 20 rows for the operator to write the
// weights into by hand. Whatever has already been entered on the covering
// page is printed in; the rest stay blank.
//
// Twenty is a floor, not a cap: a covering that has already recorded more
// than 20 beams gets a row for every one of them. Dropping a weight
// somebody entered to keep the sheet a fixed size would be a silent loss.
const BEAM_ROWS = 20;

const fmtKg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** The rows to print, split into two side-by-side halves. */
export function beamSheetRows(
  entries: BeamEntry[],
  minRows = BEAM_ROWS
): Array<Array<BeamEntry | null>> {
  const recorded = [...entries].sort((a, b) => a.beamNo - b.beamNo);
  const count = Math.max(minRows, recorded.length);
  const half = Math.ceil(count / 2);
  const cells: Array<BeamEntry | null> = Array.from(
    { length: half * 2 },
    (_, i) => recorded[i] ?? null
  );
  return [cells.slice(0, half), cells.slice(half)];
}

function BeamWeightTable({
  rows,
  startAt,
}: {
  rows: Array<BeamEntry | null>;
  startAt: number;
}) {
  return (
    <SheetTable
      head={
        <tr>
          <Th align="center">S.No</Th>
          <Th align="center">Beam #</Th>
          <Th align="right">Weight (kg)</Th>
          <Th>Remarks</Th>
        </tr>
      }
    >
      <tbody>
        {rows.map((entry, i) => (
          <tr key={startAt + i}>
            {/* The serial number is always printed, which is also what
                gives a blank row its height on paper. */}
            <Td align="center">{startAt + i}</Td>
            <Td align="center">{entry ? entry.beamNo : ""}</Td>
            <Td align="right">{entry ? fmtKg(entry.weight) : ""}</Td>
            <Td>{entry?.note ?? ""}</Td>
          </tr>
        ))}
      </tbody>
    </SheetTable>
  );
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

  const beams = covering.beamEntries ?? [];
  const [leftRows, rightRows] = beamSheetRows(beams);
  // producedWeight is the server's own sum; fall back to the entries when
  // an older covering has none, and print a blank rule when nothing is in.
  const recordedKg =
    covering.producedWeight ?? beams.reduce((s, b) => s + (b.weight || 0), 0);

  return (
    <PrintModal open={open} onClose={onClose} title="Covering programme">
      <div className="text-ink-900">
        <SheetHeader
          title="Covering Programme"
          subtitle="Covering build sheet for one job order"
          fields={[
            { label: "Job order", value: <strong>J-{covering.job?.jobOrderNo ?? "—"}</strong> },
            { label: "Opened", value: covering.date ? new Date(covering.date).toLocaleDateString() : "—" },
            { label: "Status", value: <span className="capitalize">{covering.status.replace("_", " ")}</span> },
            { label: "Lines", value: lines.length },
          ]}
        />

        <SheetPane label="Customer" className="mt-3">
          <strong>{covering.job?.customer?.name ?? "—"}</strong>
        </SheetPane>

        <SheetSection>Elastics — {lines.length} item(s)</SheetSection>
        <div className="overflow-x-auto">
          <SheetTable
            head={
              <tr>
                <Th>S.No</Th>
                <Th>Elastic</Th>
                <Th align="right">Qty (m)</Th>
                <Th>Warp spandex</Th>
                <Th>Sp. covering</Th>
                <Th align="right">Sp. ends</Th>
                <Th align="right">Total wt (g/m)</Th>
                <Th align="right">Exp. produce (kg)</Th>
              </tr>
            }
          >
            <tbody>
              {lines.map((line, i) => {
                const el = asPopulated(line);
                const wt = totalWeight(el);
                return (
                  <tr key={i}>
                    <Td>{i + 1}</Td>
                    <Td>{el?.name ?? "—"}</Td>
                    <Td align="right">{line.quantity.toLocaleString("en-IN")}</Td>
                    <Td>{materialName(el?.warpSpandex)}</Td>
                    <Td>{materialName(el?.spandexCovering)}</Td>
                    <Td align="right">{el?.spandexEnds ?? "—"}</Td>
                    <Td align="right">{wt > 0 ? wt.toFixed(2) : "—"}</Td>
                    <Td align="right">{wt > 0 ? ((line.quantity * wt) / 1000).toFixed(2) : "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
            {expectedTotalKg > 0 && (
              <tfoot>
                <tr className="font-semibold">
                  <Td colSpan={7}>Expected covering weight (total)</Td>
                  <Td align="right">{expectedTotalKg.toFixed(2)} kg</Td>
                </tr>
              </tfoot>
            )}
          </SheetTable>
        </div>

        <SheetSection>
          Beam weights — {beams.length > 0
            ? `${beams.length} recorded, rest blank for entry`
            : "to be entered at the machine"}
        </SheetSection>
        <div className="grid grid-cols-2 gap-3">
          <BeamWeightTable rows={leftRows} startAt={1} />
          <BeamWeightTable rows={rightRows} startAt={leftRows.length + 1} />
        </div>
        <div className="mt-1 flex justify-end">
          <div className="border border-ink-300 px-2 py-1 text-xs">
            <span className="font-bold uppercase tracking-wide text-ink-600">
              Total recorded weight:
            </span>{" "}
            <span className="font-semibold tabular-nums">
              {recordedKg > 0 ? `${fmtKg(recordedKg)} kg` : "____________ kg"}
            </span>
          </div>
        </div>

        {covering.remarks && (
          <SheetPane label="Remarks" className="mt-3">
            {covering.remarks}
          </SheetPane>
        )}

        <SheetSignatures labels={["Covering operator", "Supervisor", "Checked by"]} />
      </div>
    </PrintModal>
  );
}
