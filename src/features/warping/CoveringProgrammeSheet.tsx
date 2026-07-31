import { PrintModal } from "@/components/print/PrintModal";
import {
  SheetHeader, SheetPane, SheetSection, SheetTable, SheetSignatures, Th, Td,
} from "@/components/print/SheetForm";
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
