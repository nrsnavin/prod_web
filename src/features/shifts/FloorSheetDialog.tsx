import { useState } from "react";
import { Download } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { toISODate } from "@/features/analytics/components/FilterBar";
import { sheetService } from "./sheet";

// ══════════════════════════════════════════════════════════════════
//  THE FLOOR SHEET — print it before there is a plan
//
//  Every machine, the job it is running or FREE, and blank Operator,
//  Timer, Production and Supervisor-signature columns, with a QR per
//  row. Fill it on the floor, photograph it into Production Slips (or
//  WhatsApp): if the shift still has no plan, the app offers to create
//  it from the sheet, and the metres written become the draft to save.
// ══════════════════════════════════════════════════════════════════

/** Day until 8 pm, then night — the shift someone printing now most likely means. */
export function likelyShift(now = new Date()): "DAY" | "NIGHT" {
  return now.getHours() >= 20 || now.getHours() < 6 ? "NIGHT" : "DAY";
}

export function FloorSheetDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [dateKey, setDateKey] = useState(toISODate(new Date()));
  const [shift, setShift] = useState<"DAY" | "NIGHT">(likelyShift());
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      await sheetService.downloadFloor(dateKey, shift);
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not download the sheet", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Floor production sheet" width="max-w-md">
      <div className="space-y-4 text-sm">
        <p className="text-ink-600">
          Every machine with its current job, or FREE, and blank columns for operator, timer,
          production and the supervisor&apos;s signature. No plan needed. Photograph it filled in under
          Production Slips and the app creates the shift plan from it.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
          <Select
            label="Shift"
            value={shift}
            onChange={(e) => setShift(e.target.value as "DAY" | "NIGHT")}
            options={[{ value: "DAY", label: "Day" }, { value: "NIGHT", label: "Night" }]}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={download} loading={busy} disabled={!dateKey}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
}
