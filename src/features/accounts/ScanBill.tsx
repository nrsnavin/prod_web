import { useRef, useState } from "react";
import { ScanLine, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { accountsService } from "./api";
import { money } from "./shared";
import type { LineInput, ScanResult } from "./types";
import { qrFromPhoto } from "@/features/floor/photoQr";

/**
 * An e-invoice QR code in the photos, read here on the device (the
 * browser's own reader, else jsQR) and sent along as text. A supplier's
 * e-invoice code holds a signed token: three dot-separated parts. The
 * server reads it again, and looks in a PDF itself.
 */
async function einvoiceCodeIn(files: File[]): Promise<string | null> {
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    const text = await qrFromPhoto(f, [2400, 1600, 1000]).catch(() => null);
    if (text && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(text.trim())) return text.trim();
  }
  return null;
}

/** What a scan hands the bill or expense form. */
export interface ScanDraft {
  supplier?: { _id: string; name: string };
  supplierName: string;
  supplierGstin: string;
  billNo: string;
  billDate: string | null;
  lines: LineInput[];
  purchaseOrder?: string;
  /** The goods receipts the bill's lines were matched to, on `purchaseOrder`. */
  inwards?: string[];
  /** The supplier's e-invoice QR, as its text: the bill keeps its IRN. */
  einvoiceQr?: string;
  /** "line": read from a typed or spoken line of petty cash; "scan" (the default with a suggestion): a photo. */
  source?: "scan" | "line";
  /** Cash already spent: the form opens paid, from the cash box. */
  paidInCash?: boolean;
  aiSuggestion: string | null;
  kind: "bill" | "receipt";
  /** Set when the draft comes from elsewhere (a lorry receipt): the bill's kind, reverse charge and head. */
  billKind?: "goods" | "service";
  reverseCharge?: boolean;
  category?: string;
}

/**
 * What the form opens with. As a supplier bill, the lines matched to the
 * goods received carry their material, and the receipts they cover go
 * with the bill (they used to be left behind, still "not billed"). An
 * expense takes the figures only.
 */
export function draftFrom(r: ScanResult, as: "bill" | "expense" = "bill"): ScanDraft {
  const poWithReceipts = r.purchaseOrders.find((p) => p.unbilledReceipts > 0);
  const match = as === "bill" ? r.receiptMatch ?? null : null;
  const placed = new Map((match?.lines ?? []).map((l) => [l.index, l]));
  return {
    supplier: r.supplier ? { _id: r.supplier._id, name: r.supplier.name } : undefined,
    supplierName: r.read.supplierName,
    supplierGstin: r.read.supplierGstin,
    billNo: r.read.billNo,
    billDate: r.read.billDate,
    lines: r.read.lines.map((l, i) => ({
      ...(placed.get(i) ? { rawMaterial: placed.get(i)!.rawMaterial } : {}),
      description: l.description, hsn: l.hsn, unit: l.unit, quantity: l.quantity, rate: l.rate ?? "", gstPercent: l.gstPercent ?? "",
    })),
    purchaseOrder: match ? match.purchaseOrder._id : r.purchaseOrders.length === 1 && poWithReceipts ? poWithReceipts._id : undefined,
    inwards: match ? match.lines.flatMap((l) => l.inwards) : undefined,
    einvoiceQr: as === "bill" && r.einvoiceQr ? r.einvoiceQr : undefined,
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
      setResult(await accountsService.scan(list, await einvoiceCodeIn(list)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read the bill", "error");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const read = result?.read;
  const lowConfidence = read ? read.confidence < 0.6 || read.lines.some((l) => l.confidence < 0.6) : false;
  // Lines whose figures do not add up (utils/billArithmetic.js on the server).
  const wrongLines = new Set((result?.checks?.issues ?? []).filter((x) => x.line != null && x.severity === "danger").map((x) => x.line as number));

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
              <thead><tr className="border-b border-ink-200 text-xs text-ink-500 font-medium"><th className="py-1 text-left font-medium">Line</th><th className="py-1 text-left font-medium">HSN</th><th className="py-1 text-right font-medium">Qty</th><th className="py-1 text-right font-medium">Rate</th><th className="py-1 text-right font-medium">GST</th><th className="py-1 text-right font-medium">Amount</th><th className="py-1 text-right font-medium">Sure</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {read.lines.map((l, i) => (
                  <tr key={i} className={wrongLines.has(i) ? "text-status-danger" : l.confidence < 0.6 ? "text-status-warning" : ""}><td className="py-1">{l.description}</td><td className="py-1">{l.hsn || "—"}</td><td className="py-1 text-right tabular-nums">{l.quantity} {l.unit}</td><td className="py-1 text-right tabular-nums">{l.rate != null ? money(l.rate) : "—"}</td><td className="py-1 text-right">{l.gstPercent != null ? `${l.gstPercent}%` : "—"}</td><td className="py-1 text-right tabular-nums">{l.amount != null ? money(l.amount) : "—"}</td><td className="py-1 text-right">{Math.round(l.confidence * 100)}%</td></tr>
                ))}
              </tbody>
            </table>
            <EinvoiceNote result={result} />
            <ReadChecksNote result={result} />
            {result?.receiptMatch ? (
              <ReceiptMatchNote result={result} />
            ) : result && result.purchaseOrders.length > 0 && (
              <p className="text-sm text-ink-500">{result.supplier?.name} has {result.purchaseOrders.filter((p) => p.unbilledReceipts > 0).map((p) => `PO #${p.poNo} (${p.unbilledReceipts} receipt${p.unbilledReceipts === 1 ? "" : "s"} to bill)`).join(", ") || "no receipts waiting to be billed"}.</p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => { setResult(null); ref.current?.click(); }}>Scan another</Button>
              <Button variant="secondary" onClick={() => result && onUse(draftFrom(result, "expense"), "expense")} disabled={photoHeld}>Use as expense</Button>
              <Button onClick={() => result && onUse(draftFrom(result), "bill")} disabled={!!result?.alreadyEntered || photoHeld}>Use as supplier bill</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/** The figures that do not add up: shown before the form, so the bill is checked against the paper. */
function ReadChecksNote({ result }: { result: ScanResult | null }) {
  const issues = result?.checks?.issues ?? [];
  if (!issues.length) return null;
  const danger = issues.some((x) => x.severity === "danger");
  return (
    <div role="alert" aria-label="Figures that do not add up" className={`space-y-1 rounded-lg px-3 py-2 text-sm ${danger ? "bg-status-dangerBg text-status-danger" : "bg-status-warningBg text-status-warning"}`}>
      <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> {danger ? "These figures do not add up: check them against the bill" : "Check these on the bill"}</p>
      <ul className="list-disc space-y-0.5 pl-6">
        {issues.map((x, i) => <li key={i}>{x.message}</li>)}
      </ul>
    </div>
  );
}

/** Which lines took which goods receipts, and what is left to bill on the PO. */
function ReceiptMatchNote({ result }: { result: ScanResult }) {
  const m = result.receiptMatch;
  if (!m) return null;
  const lines = result.read.lines;
  const off = m.lines.filter((l) => !l.quantityMatches);
  return (
    <div className="space-y-1 rounded-lg bg-ink-50 px-3 py-2 text-sm" aria-label="Goods received">
      <p className="font-medium">Goods received on PO #{m.purchaseOrder.poNo}</p>
      <ul className="space-y-0.5 text-ink-600">
        {m.lines.map((l) => (
          <li key={l.index}>
            {lines[l.index]?.description || `Line ${l.index + 1}`} → {l.material}
            {l.quantityMatches ? `, ${l.inwards.length} receipt${l.inwards.length === 1 ? "" : "s"} (${l.quantityReceived})` : ""}
          </li>
        ))}
        {m.unmatched.map((i) => <li key={`u${i}`} className="text-ink-400">{lines[i]?.description || `Line ${i + 1}`}: not goods received, stays as read</li>)}
      </ul>
      {off.length > 0 && (
        <p className="text-status-warning">{off.map((l) => lines[l.index]?.description || `Line ${l.index + 1}`).join(", ")}: the quantity does not match the receipts ({off.map((l) => l.quantityReceived).join(", ")} received), so no receipt is taken for {off.length === 1 ? "it" : "them"}.</p>
      )}
      {m.receiptsLeft.length > 0 && (
        <p className="text-ink-400">Still to bill on this PO: {m.receiptsLeft.map((r) => `${r.material} ${r.quantity} ${r.unit}`).join(", ")}.</p>
      )}
    </div>
  );
}

/** What the supplier's e-invoice code says, and where the paper read differently. */
function EinvoiceNote({ result }: { result: ScanResult | null }) {
  const e = result?.einvoice;
  if (!e) return null;
  const danger = e.notes.some((n) => n.severity === "danger");
  return (
    <div role="note" aria-label="E-invoice code" className={`space-y-1 rounded-lg px-3 py-2 text-sm ${danger ? "bg-status-dangerBg text-status-danger" : "bg-status-infoBg text-ink-700"}`}>
      <p className="font-medium">E-invoice code read: the GSTIN, bill number, date and total are the GST portal's</p>
      <p className="text-xs">IRN …{e.irn.slice(-10)} · {e.signature === "verified" ? "signature checked with the portal's key" : `signature not checked (${e.signatureNote.toLowerCase()})`}</p>
      {e.notes.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-6">
          {e.notes.map((n, i) => <li key={i} className={n.severity === "danger" ? "font-medium" : ""}>{n.message}</li>)}
        </ul>
      )}
    </div>
  );
}
