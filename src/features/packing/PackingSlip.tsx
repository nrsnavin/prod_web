import { PrintModal } from "@/components/print/PrintModal";
import { QrImg } from "@/components/print/QrImg";
import { PackingRecord } from "./types";

function name(x?: { name: string } | string | null): string {
  return typeof x === "object" && x ? x.name : "—";
}

// Packing slip — mirrors the Flutter packing PDF: production details
// (meters, joints, stretch, size) + weights + sign-offs.
export function PackingSlip({
  open,
  onClose,
  record,
  jobNo,
  customerName,
}: {
  open: boolean;
  onClose: () => void;
  record: PackingRecord;
  jobNo?: number | string;
  customerName?: string;
}) {
  const rows: Array<[string, string]> = [
    ["Elastic", name(record.elastic)],
    ["Meters", `${record.meter.toLocaleString()} m`],
    ["Joints", String(record.joints ?? 0)],
    ["Stretch", record.stretch || "—"],
    ["Size", record.size || "—"],
    ["Net weight", record.netWeight != null ? `${record.netWeight} kg` : "—"],
    ["Tare weight", record.tareWeight != null ? `${record.tareWeight} kg` : "—"],
    ["Gross weight", record.grossWeight != null ? `${record.grossWeight} kg` : "—"],
    ["Batch", record.batch || "—"],
    [
      "Packed on",
      record.createdAt ? new Date(record.createdAt).toLocaleDateString() : "—",
    ],
  ];

  return (
    <PrintModal open={open} onClose={onClose} title="Packing slip">
      <div className="print-label text-ink-900 max-w-md mx-auto border-2 border-ink-900 rounded-sm p-4">
        <div className="text-center border-b-2 border-ink-900 pb-2">
          <h1 className="text-lg font-black tracking-wide">PACKING SLIP</h1>
          <p className="text-sm font-bold">
            {jobNo != null ? `JOB J-${jobNo}` : ""} {customerName ? `· ${customerName}` : ""}
          </p>
        </div>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-ink-100">
                <td className="py-1.5 text-ink-600">{label}</td>
                <td className="py-1.5 text-right font-semibold tabular-nums">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-center">
          <QrImg value={`BOX|${record._id}|J:${jobNo ?? ""}`} size={72} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-ink-600">
          <div className="border-t border-ink-400 pt-1">
            Checked by: {name(record.checkedBy)}
          </div>
          <div className="border-t border-ink-400 pt-1 text-right">
            Packed by: {name(record.packedBy)}
          </div>
        </div>
      </div>
    </PrintModal>
  );
}
