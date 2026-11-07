import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

// ══════════════════════════════════════════════════════════════════
//  Count the cones from a photo (experimental): the AI counts what it
//  can see, row by row; the cone's weight turns it into kilograms. The
//  person checks the count before it goes on the sheet.
// ══════════════════════════════════════════════════════════════════

export interface ConeReading {
  read: { problem: null | "no_cones" | "unreadable"; cones?: number; rows?: number | null; perRow?: number | null; layers?: number | null; hidden?: boolean; confidence?: number; note?: string };
  material?: { name: string; unit: string; coneWeightKg: number | null };
  estimate: { quantity: number; unit: string; basis: string } | null;
  aiSuggestion: string | null;
}

export function ConeCountDialog({ countId, lineId, name, onUse, onClose }: {
  countId: string; lineId: string; name: string;
  onUse: (entry: { countedQty: number; cones: number; aiSuggestion: string | null }) => Promise<void> | void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ConeReading | null>(null);
  const [cones, setCones] = useState("");

  const send = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("lineId", lineId);
      if (weight.trim()) fd.append("coneWeightKg", weight.trim());
      const r = await fetch(`/api/v2/stock-counts/${countId}/cones`, { method: "POST", body: fd, credentials: "include" });
      const body = (await r.json().catch(() => ({}))) as ConeReading & { message?: string };
      if (!r.ok) throw new Error(body.message || "Could not count the cones");
      if (body.read.problem) { toast(body.read.problem === "no_cones" ? "No cones in that photo" : "The photo could not be read — try a closer, brighter one", "info"); return; }
      setRes(body); setCones(String(body.read.cones ?? ""));
      if (!weight && body.material?.coneWeightKg) setWeight(String(body.material.coneWeightKg));
    } catch (e) { toast(e instanceof Error ? e.message : "Could not count the cones", "error"); } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };

  const unit = res?.material?.unit ?? "kg";
  const byCone = unit === "cones" || unit === "nos";
  const n = Number(cones); const w = Number(weight);
  const qty = byCone ? n : n > 0 && w > 0 ? Math.round(n * w * 1000) / 1000 : null;

  return (
    <Modal open onClose={onClose} title={`Count cones · ${name}`}>
      <div className="space-y-3">
        <p className="text-xs text-ink-500">Experimental. Photograph one rack or pallet face-on, in good light. Check the count before using it.</p>
        <div className="flex flex-wrap items-end gap-2">
          {!byCone && <Input label="One cone weighs (kg)" type="number" min={0} step="any" className="w-40" value={weight} onChange={(e) => setWeight(e.target.value)} hint="Kept for this yarn" />}
          <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" aria-label="cones photo" onChange={(e) => send(e.target.files?.[0])} />
          <Button variant="secondary" loading={busy} onClick={() => ref.current?.click()}><Camera className="h-4 w-4" /> {res ? "Another photo" : "Photograph the cones"}</Button>
        </div>
        {res && (
          <div className="space-y-2 rounded-lg border border-ink-100 p-3 text-sm">
            <p role="status">
              Counted <strong>{res.read.cones}</strong> cones
              {res.read.rows && res.read.perRow ? ` (${res.read.rows} rows × ${res.read.perRow}${res.read.layers && res.read.layers > 1 ? ` × ${res.read.layers} layers` : ""})` : ""}
              {" "}· {Math.round((res.read.confidence ?? 0) * 100)}% sure{res.read.note ? ` · ${res.read.note}` : ""}
            </p>
            {res.read.hidden && <p className="text-status-warning">Some cones are hidden in the photo — count those by hand and add them.</p>}
            <Input label="Cones" type="number" min={0} className="w-32" value={cones} onChange={(e) => setCones(e.target.value)} />
            <p className="text-ink-600">{qty != null ? `${qty} ${unit} on the sheet${byCone ? "" : ` (${n} × ${w} kg)`}` : "Give the weight of one cone to work out the kilograms."}</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button disabled={qty == null || !(n >= 0)} onClick={async () => { await onUse({ countedQty: qty!, cones: n, aiSuggestion: res.aiSuggestion }); onClose(); }}>Put {qty ?? "—"} {unit} on the sheet</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
