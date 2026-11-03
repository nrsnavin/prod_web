import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, ReceiptIndianRupee } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { accountsService } from "@/features/accounts/api";
import type { ScanDraft } from "@/features/accounts/ScanBill";
import { dcService, type LrScan } from "./api";

/**
 * The transporter's lorry receipt, photographed: its LR number, vehicle
 * and transporter go onto the challan once checked, and its freight
 * opens in Accounts as an expense — or, for a transporter not registered
 * for GST, as a service bill under reverse charge.
 */
export function LorryReceiptDialog({ dc, onClose }: {
  dc: { _id: string; dcNumber: string; lrNumber?: string; vehicleNo?: string; transporter?: string; driverName?: string };
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [scan, setScan] = useState<LrScan | null>(null);
  const [lrNumber, setLrNumber] = useState(dc.lrNumber ?? "");
  const [vehicleNo, setVehicleNo] = useState(dc.vehicleNo ?? "");
  const [transporter, setTransporter] = useState(dc.transporter ?? "");
  const [freight, setFreight] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  const read = async (file?: File) => {
    if (!file) return;
    setReading(true);
    try {
      const r = await dcService.scanLr(dc._id, file);
      setScan(r);
      if (r.read.problem) { toast(r.read.problem === "not_an_lr" ? "That does not look like a lorry receipt" : "The receipt could not be read — type the details in", "info"); return; }
      if (r.read.lrNumber) setLrNumber(r.read.lrNumber);
      if (r.read.vehicleNo) setVehicleNo(r.read.vehicleNo);
      setTransporter(r.transporter?.name || r.read.transporterName || transporter);
      if (r.read.freight) setFreight(r.read.freight);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read the receipt", "error");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await dcService.saveTransport(dc._id, { lrNumber, vehicleNo, transporter, aiSuggestion: scan?.aiSuggestion ?? undefined });
      qc.invalidateQueries({ queryKey: ["dc"] });
      qc.invalidateQueries({ queryKey: ["delivery-challans"] });
      toast("Saved to the challan", "success");
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  /** Save, then open the freight in Accounts, filled in. */
  const freightToAccounts = async () => {
    if (!(await save())) return;
    const heads = await accountsService.categories().catch(() => []);
    const head = heads.find((c) => /transport|freight/i.test(c.name) && c.active !== false);
    const rcm = scan?.transporter?.gstRegistration === "unregistered";
    const draft: ScanDraft & { billKind?: "service"; reverseCharge?: boolean; category?: string } = {
      supplier: scan?.transporter ? { _id: scan.transporter._id, name: scan.transporter.name } : undefined,
      supplierName: transporter, supplierGstin: scan?.transporter?.gstin || scan?.read.transporterGstin || "",
      billNo: lrNumber, billDate: scan?.read.lrDate ?? null,
      lines: [{ description: `Freight · LR ${lrNumber} · ${dc.dcNumber}${scan?.read.destination ? ` to ${scan.read.destination}` : ""}`, hsn: "9965", unit: "", quantity: 1, rate: Number(freight) || 0, gstPercent: rcm ? 5 : 0 }],
      aiSuggestion: null, kind: "receipt",
      ...(rcm ? { billKind: "service" as const, reverseCharge: true, category: head?._id } : {}),
    };
    onClose();
    if (rcm && draft.supplier) navigate("/accounts/bills", { state: { reenter: draft, title: "Freight bill from the lorry receipt — reverse charge, check every figure" } });
    else navigate("/accounts/expenses", { state: { reenter: draft, category: head?._id, title: "Freight from the lorry receipt — check every figure" } });
  };

  return (
    <Modal open onClose={onClose} title={`Lorry receipt · ${dc.dcNumber}`} width="max-w-lg">
      <div className="space-y-3">
        <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" aria-label="Lorry receipt photo" onChange={(e) => read(e.target.files?.[0])} />
        <Button variant="secondary" loading={reading} onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4" /> {scan ? "Read another photo" : "Photograph the lorry receipt"}</Button>
        {scan && !scan.read.problem && <p className="text-xs text-ink-500">Read from the photo — check each figure. {scan.transporter ? `Transporter on file: ${scan.transporter.name}${scan.transporter.gstRegistration === "unregistered" ? " (not registered for GST — reverse charge applies)" : ""}.` : "The transporter is not on file as a supplier."}</p>}
        {scan?.checks.length ? <ul role="alert" className="space-y-1 rounded-lg bg-status-warningBg p-2 text-sm text-status-warning">{scan.checks.map((c) => <li key={c}>{c}</li>)}</ul> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="LR number" value={lrNumber} onChange={(e) => setLrNumber(e.target.value)} />
          <Input label="Vehicle no" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
          <Input label="Transporter" value={transporter} onChange={(e) => setTransporter(e.target.value)} />
          <Input label="Freight (₹)" type="number" min={0} value={freight} onChange={(e) => setFreight(e.target.value === "" ? "" : Number(e.target.value))} hint={scan?.read.paidBy === "to_pay" ? "Marked to-pay: the customer pays it" : undefined} />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" loading={saving} disabled={!lrNumber.trim() && !vehicleNo.trim()} onClick={async () => { if (await save()) onClose(); }}>Save to the challan</Button>
          <Button loading={saving} disabled={!lrNumber.trim() || !(Number(freight) > 0) || scan?.read.paidBy === "to_pay"} onClick={freightToAccounts}><ReceiptIndianRupee className="h-4 w-4" /> Save and enter the freight</Button>
        </div>
      </div>
    </Modal>
  );
}
