import { Card } from "@/components/ui/Card";
import { useDocumentSettings } from "@/features/settings/hooks";
import { PurchaseOrder, PoItem, PoSupplierRef } from "./types";

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function itemName(it: PoItem): string {
  return typeof it.rawMaterial === "object" && it.rawMaterial ? it.rawMaterial.name : "—";
}
function itemUnit(it: PoItem): string {
  return (typeof it.rawMaterial === "object" && it.rawMaterial && it.rawMaterial.unit) || "";
}
function supplier(po: PurchaseOrder): PoSupplierRef | null {
  return typeof po.supplier === "object" && po.supplier ? po.supplier : null;
}
function fmtDate(d?: string): string {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

// ── Indian-system amount in words ───────────────────────────────
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return `${h ? ONES[h] + " Hundred" + (r ? " " : "") : ""}${r ? twoDigits(r) : ""}`;
}
function amountInWords(num: number): string {
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero Rupees";
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  let words = parts.join(" ").trim() + " Rupees";
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return words;
}

export function PoDocument({ po }: { po: PurchaseOrder }) {
  const s = supplier(po);
  const total = po.items.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 0), 0);
  // Buyer details come from Settings → Document settings — the same source
  // the generated PDF uses. They were previously hardcoded placeholders,
  // so this sheet printed a different (fictional) company from the PDF.
  const { data: doc } = useDocumentSettings();
  const company = {
    name: doc?.companyName ?? "",
    addressLines: (doc?.addressLines ?? []).filter(Boolean),
    gstin: doc?.gstin ?? "",
    phone: doc?.phone ?? "",
  };
  const gstinPhone = [company.gstin && `GSTIN: ${company.gstin}`, company.phone]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="print-area">
      <Card className="mx-auto max-w-3xl p-8 text-ink-900 print:max-w-none print:p-0 print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-ink-900 pb-4">
          <div className="flex items-start gap-3">
            {doc?.logo && (
              <img src={doc.logo} alt="" className="h-12 w-12 shrink-0 object-contain" />
            )}
            <div>
              <h1 className="text-lg font-bold" style={{ color: doc?.accentColor || undefined }}>
                {company.name}
              </h1>
              {doc?.tagline && <p className="text-xs text-ink-400">{doc.tagline}</p>}
              {company.addressLines.map((l) => (
                <p key={l} className="text-xs text-ink-600">{l}</p>
              ))}
              {gstinPhone && <p className="mt-0.5 text-xs text-ink-600">{gstinPhone}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold tracking-wide">PURCHASE ORDER</h2>
            <p className="mt-1 text-sm">
              <span className="text-ink-400">PO No: </span>
              <span className="font-semibold">#{po.poNo}</span>
            </p>
            <p className="text-sm">
              <span className="text-ink-400">Date: </span>
              {fmtDate(po.date ?? po.createdAt)}
            </p>
            <p className="text-sm">
              <span className="text-ink-400">Status: </span>
              {po.status}
            </p>
          </div>
        </div>

        {/* Vendor + Ship-to */}
        <div className="grid grid-cols-2 gap-6 border-b border-ink-200 py-4 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Vendor</p>
            <p className="font-semibold">{s?.name ?? "—"}</p>
            {s?.address && <p className="text-ink-600">{s.address}</p>}
            {s?.contactPerson && <p className="text-ink-600">Attn: {s.contactPerson}</p>}
            {s?.phoneNumber && <p className="text-ink-600">Ph: {s.phoneNumber}</p>}
            {s?.gstin && <p className="text-ink-600">GSTIN: {s.gstin}</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Ship to</p>
            <p className="font-semibold">{company.name}</p>
            {company.addressLines.map((l) => (
              <p key={l} className="text-ink-600">{l}</p>
            ))}
            <p className="mt-1 text-ink-600">
              <span className="text-ink-400">Requested delivery: </span>
              {fmtDate(po.expectedDate)}
            </p>
          </div>
        </div>

        {/* Items */}
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink-300 text-xs uppercase tracking-wide text-ink-500">
              <th className="py-2 text-left w-8">#</th>
              <th className="py-2 text-left">Material</th>
              <th className="py-2 text-left w-16">Unit</th>
              <th className="py-2 text-right w-20">Qty</th>
              <th className="py-2 text-right w-24">Rate (₹)</th>
              <th className="py-2 text-right w-28">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((it, i) => (
              <tr key={i} className="border-b border-ink-100 print-label">
                <td className="py-2">{i + 1}</td>
                <td className="py-2 font-medium">{itemName(it)}</td>
                <td className="py-2 text-ink-600">{itemUnit(it) || "—"}</td>
                <td className="py-2 text-right tabular-nums">{(it.quantity || 0).toLocaleString("en-IN")}</td>
                <td className="py-2 text-right tabular-nums">{inr(it.price || 0)}</td>
                <td className="py-2 text-right tabular-nums">{inr((it.price || 0) * (it.quantity || 0))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink-300 font-semibold">
              <td className="py-2" colSpan={5}>Grand total</td>
              <td className="py-2 text-right tabular-nums">₹{inr(total)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-2 text-xs text-ink-500">
          Amount in words: <span className="font-medium text-ink-700">{amountInWords(total)} only</span>
        </p>
        <p className="text-[10px] text-ink-400">Amounts in ₹, exclusive of applicable taxes unless stated.</p>

        {/* Terms */}
        <div className="mt-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Terms &amp; notes</p>
          {/* PO-specific notes win; otherwise the standing terms configured
              in Settings → Document settings, then a generic fallback. */}
          <p className="mt-1 whitespace-pre-wrap text-ink-600">
            {po.notes?.trim() ||
              doc?.termsText?.trim() ||
              "Please supply the above materials as per agreed specifications. Quote this PO number on the invoice and delivery challan."}
          </p>
        </div>

        {/* Signatures */}
        <div className="mt-12 grid grid-cols-2 gap-6 text-sm text-ink-600">
          <div className="border-t border-ink-300 pt-2">Prepared by</div>
          <div className="border-t border-ink-300 pt-2 text-right">
            For {company.name}
            <br />
            <span className="mt-6 inline-block">Authorised signatory</span>
          </div>
        </div>

        {doc?.footerNote && (
          <p className="mt-6 border-t border-ink-200 pt-3 text-xs text-ink-400">{doc.footerNote}</p>
        )}
      </Card>
    </div>
  );
}
