import { useRef, useState } from "react";
import { Camera, Copy, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { MaterialRow, ProductLine, newKey, newProduct } from "./costing";
import { uploadForm } from "@/core/http/upload";

// ══════════════════════════════════════════════════════════════════
//  "Draft from an enquiry": the customer's message (or a photo of their
//  sample) read into the quote — the elastic each item is, its cost a
//  metre from the recipe, a margin from past quotes and why. The price
//  is the person's to set; nothing is saved until they raise the quote.
// ======================================================================

export interface EnquiryLine {
  productName: string; productSpec: string; elastic: string | null; quantityMetres: number;
  materials: { label: string; weightGrams: number; ratePerKg: number }[];
  conversionCost: number; marginPercent: number; cost: number | null; rate: number | null; reasons: string[];
  candidates: { _id: string; name: string }[];
}
export interface EnquiryResult {
  read: { problem: null | "not_an_enquiry" | "unreadable"; neededBy?: string };
  customer: { _id: string; name: string } | null;
  customerName?: string;
  lines: EnquiryLine[];
  coverNote: string;
  aiSuggestion: string | null;
}

/** A drafted line as the form's product. */
export function productFromEnquiry(l: EnquiryLine): ProductLine {
  const rows: MaterialRow[] = l.materials.map((m) => ({ key: newKey(), label: m.label, weightGrams: String(m.weightGrams), ratePerKg: String(m.ratePerKg) }));
  return {
    ...newProduct(),
    productName: l.productName,
    productSpec: l.productSpec,
    ...(l.elastic ? { elastic: l.elastic } : {}),
    ...(rows.length ? { materials: rows } : {}),
    ...(l.conversionCost ? { conversionCost: String(l.conversionCost) } : {}),
    marginPercent: String(l.marginPercent),
    quantityMetres: l.quantityMetres ? String(l.quantityMetres) : "",
  };
}

export function EnquiryDraft({ onDraft }: { onDraft: (r: EnquiryResult) => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EnquiryResult | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      if (text.trim()) fd.append("text", text.trim());
      files.forEach((f) => fd.append("files", f));
      const body = await uploadForm<EnquiryResult>("/quote/from-enquiry", fd, "Could not read the enquiry");
      if (body.read.problem) { toast("That does not read as an enquiry for elastic", "info"); return; }
      setResult(body);
      onDraft(body);
      toast("Drafted — check each price before raising it", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read the enquiry", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3 p-5">
      <div>
        <h3 className="font-semibold">Draft from an enquiry</h3>
        <p className="text-sm text-ink-500">Paste their WhatsApp or email, or photograph their sample. Costs come from the recipe at today's prices; the margin from quotes they accepted or declined.</p>
      </div>
      <label className="sr-only" htmlFor="enquiry-text">Enquiry</label>
      <textarea id="enquiry-text" rows={3} className="w-full rounded-lg border border-ink-200 p-2 text-sm" placeholder="Need 20000 m 25mm black knitted, rate?" value={text} onChange={(e) => setText(e.target.value)} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" aria-label="enquiry photo" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4" /> {files.length ? `${files.length} photo${files.length === 1 ? "" : "s"}` : "Add a photo"}</Button>
        <Button type="button" size="sm" loading={busy} disabled={!text.trim() && !files.length} onClick={run}><Sparkles className="h-4 w-4" /> Draft the quote</Button>
      </div>
      {result && (
        <div className="space-y-2 text-sm">
          {result.lines.map((l, i) => (
            <div key={i} role="note" className="rounded-lg bg-ink-50 p-2">
              <p className="font-medium text-ink-800">{l.productName}{l.cost ? ` — cost ₹${l.cost.toFixed(2)}/m, at ${l.marginPercent}% ₹${l.rate?.toFixed(2)}/m` : ""}</p>
              <ul className="list-disc pl-5 text-ink-600">{l.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          ))}
          {result.coverNote && (
            <div className="rounded-lg border border-ink-100 p-2">
              <div className="mb-1 flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-wide text-ink-400">Cover note</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(result.coverNote).catch(() => {}); toast("Copied", "success"); }}><Copy className="h-4 w-4" /> Copy</Button></div>
              <pre className="whitespace-pre-wrap font-sans text-ink-700">{result.coverNote}</pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
