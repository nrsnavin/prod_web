import { useRef, useState } from "react";
import { ScanLine, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { accountsService } from "./api";
import { money } from "./shared";
import type { LineInput, ScanResult } from "./types";

/** What a scan hands the bill or expense form. */
export interface ScanDraft {
  supplier?: { _id: string; name: string };
  supplierName: string;
  supplierGstin: string;
  billNo: string;
  billDate: string | null;
  lines: LineInput[];
  purchaseOrder?: string;
  aiSuggestion: string | null;
  kind: "bill" | "receipt";
  /** Set when the draft comes from elsewhere (a lorry receipt): the bill's kind, reverse charge and head. */
  billKind?: "goods" | "service";
  reverseCharge?: boolean;
  category?: string;
}

export function draftFrom(r: ScanResult): ScanDraft {
  const poWithReceipts = r.purchaseOrders.find((p) => p.unbilledReceipts > 0);
  return {
    supplier: r.supplier ? { _id: r.supplier._id, name: r.supplier.name } : undefined,
    supplierName: r.read.supplierName,
    supplierGstin: r.read.supplierGstin,
    billNo: r.read.billNo,
    billDate: r.read.billDate,
    lines: r.read.lines.map((l) => ({ description: l.description, hsn: l.hsn, unit: l.unit, quantity: l.quantity, rate: l.rate ?? "", gstPercent: l.gstPercent ?? "" })),
    purchaseOrder: r.purchaseOrders.length === 1 && poWithReceipts ? poWithReceipts._id : undefined,
    aiSuggestion: r.aiSuggestion,
    kind: r.read.kind === "receipt" ? "receipt" : "bill",
  };
}

/**
 * Photograph a bill (or pick its PDF); what the model read is shown
 * with how sure it was, who it matched on file and whether it is
 * already entered, and then opens the bill or expense form filled in
 * — the person checks every figure before anything is saved.
 */
export function ScanBillDialog({ onClose, onUse }: { onClose: () => void; onUse: (draft: ScanDraft, as: "bill" | "expense") => void }) {
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [differentBill, setDifferentBill] = useState(false);
  const samePhoto = result?.samePhoto ?? [];
  const photoHeld = samePhoto.length > 0 && !differentBill;

  const scan = async (files: FileList | null) => {
    const list = files ? Array.from(files).slice(0, 4) : [];
    if (!list.length) return;
    setBusy(true);
    try {
      setDifferentBill(false);
      setResult(await accountsService.scan(list));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read the bill", "error");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const read = result?.read;
  const lowConfidence = read ? read.confidence < 0.6 || read.lines.some((l) => l.confidence < 0.6) : false;

  return (
    <Modal open onClose={onClose} title="Scan a bill" width="max-w-3xl" confirmDirtyClose={false}>
      <div className="space-y-4">
        <input ref={ref} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" aria-label="Bill photo or PDF" onChange={(e) => scan(e.target.files)} />
        {!result && (
          <div className="rounded-lg border border-dashed border-ink-300 p-8 text-center">
            <ScanLine className="mx-auto h-8 w-8 text-ink-300" />
            <p className="mt-2 text-sm text-ink-500">A photo of the bill (up to 4 pages) or its PDF. The figures are read into a draft for you to check.</p>
            <Button className="mt-3" loading={busy} onClick={() => ref.current?.click()}>Choose photo or PDF</Button>
          </div>
        )}
        {read && read.problem && (
          <div role="alert" className="rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
            {read.problem === "not_a_bill" ? "That does not look like a bill or a receipt." : "The bill could not be read — try a sharper, straighter photo."}
            <Button size="sm" variant="secondary" className="ml-3" onClick={() => { setResult(null); ref.current?.click(); }}>Try another</Button>
          </div>
        )}
        {read && !read.problem && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusChip tone={read.kind === "bill" ? "info" : "neutral"}>{read.kind === "bill" ? "Tax invoice" : "Receipt"}</StatusChip>
              <StatusChip tone={lowConfidence ? "warning" : "success"}>{Math.round(read.confidence * 100)}% sure</StatusChip>
              {result?.supplier ? (
                <span>Supplier on file: <span className="font-medium">{result.supplier.name}</span> <span className="text-ink-400">(matched by {result.supplier.matchedBy === "gstin" ? "GSTIN" : "name — check it"})</span></span>
              ) : (
                <span className="text-ink-500">No supplier on file matches “{read.supplierName || "?"}”{read.supplierGstin ? ` (${read.supplierGstin})` : ""} — pick one on the form or add the supplier first.</span>
              )}
            </div>
            {samePhoto.length > 0 && (
              <div role="alert" className="space-y-1 rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
                <p className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> This photo is already on {samePhoto.map((d) => `${d.docType === "SupplierBill" ? "bill" : "expense"} ${d.docNo} (${d.partyName}${d.amount != null ? `, ₹${money(d.amount)}` : ""})`).join(" and ")}.</p>
                <label className="flex items-center gap-2 text-ink-700"><input type="checkbox" checked={differentBill} onChange={(e) => setDifferentBill(e.target.checked)} /> It is a different bill — enter it anyway</label>
              </div>
            )}
            {result?.alreadyEntered && (
              <div role="alert" className="flex items-center gap-2 rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger"><AlertTriangle className="h-4 w-4" /> Bill {read.billNo} from this supplier is already entered as {result.alreadyEntered}.</div>
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-ink-400">Their bill no.</dt><dd className="font-medium">{read.billNo || "—"}</dd></div>
              <div><dt className="text-xs text-ink-400">Bill date</dt><dd className="font-medium">{read.billDate || "—"}</dd></div>
              <div><dt className="text-xs text-ink-400">GSTIN on the bill</dt><dd className="font-medium">{read.supplierGstin || "—"}</dd></div>
              <div><dt className="text-xs text-ink-400">Total printed</dt><dd className="font-medium">{read.totals.grand != null ? `₹${money(read.totals.grand)}` : "—"}</dd></div>
            </dl>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400"><th className="py-1 text-left font-medium">Line</th><th className="py-1 text-left font-medium">HSN</th><th className="py-1 text-right font-medium">Qty</th><th className="py-1 text-right font-medium">Rate</th><th className="py-1 text-right font-medium">GST</th><th className="py-1 text-right font-medium">Amount</th><th className="py-1 text-right font-medium">Sure</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {read.lines.map((l, i) => (
                  <tr key={i} className={l.confidence < 0.6 ? "text-status-warning" : ""}><td className="py-1">{l.description}</td><td className="py-1">{l.hsn || "—"}</td><td className="py-1 text-right tabular-nums">{l.quantity} {l.unit}</td><td className="py-1 text-right tabular-nums">{l.rate != null ? money(l.rate) : "—"}</td><td className="py-1 text-right">{l.gstPercent != null ? `${l.gstPercent}%` : "—"}</td><td className="py-1 text-right tabular-nums">{l.amount != null ? money(l.amount) : "—"}</td><td className="py-1 text-right">{Math.round(l.confidence * 100)}%</td></tr>
                ))}
              </tbody>
            </table>
            {result && result.purchaseOrders.length > 0 && (
              <p className="text-sm text-ink-500">{result.supplier?.name} has {result.purchaseOrders.filter((p) => p.unbilledReceipts > 0).map((p) => `PO #${p.poNo} (${p.unbilledReceipts} receipt${p.unbilledReceipts === 1 ? "" : "s"} to bill)`).join(", ") || "no receipts waiting to be billed"}.</p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => { setResult(null); ref.current?.click(); }}>Scan another</Button>
              <Button variant="secondary" onClick={() => result && onUse(draftFrom(result), "expense")} disabled={photoHeld}>Use as expense</Button>
              <Button onClick={() => result && onUse(draftFrom(result), "bill")} disabled={!!result?.alreadyEntered || photoHeld}>Use as supplier bill</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
