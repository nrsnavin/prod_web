import { useRef, useState } from "react";
import { FileText, AlertTriangle, Landmark } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { accountsService } from "./api";
import { money } from "./shared";
import type { AdvicePlaced, AdviceResult } from "./types";

// ══════════════════════════════════════════════════════════════════
//  "READ A PAYMENT ADVICE"
//
//  The customer's remittance advice — its PDF, a photo, or the mail's
//  text pasted in — read and placed on the books (api/accounts.js
//  /advice/read): who paid, the invoices it settles, the TDS and
//  discount they took, what did not match and the bank line it came in
//  on. "Fill the receipt" ticks those invoices in the form with those
//  amounts; the person checks it and posts it as any receipt.
// ══════════════════════════════════════════════════════════════════

const ADJUSTMENT_WORDS: Record<string, string> = { tds_by_customer: "TDS they deducted", discount: "Discount", bank_charges: "Bank charges", round_off: "Round-off", write_off: "Write-off" };

export function AdviceReader({ customer, onUse }: { customer?: string; onUse: (placed: AdvicePlaced, aiSuggestion: string | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}><FileText className="h-4 w-4" aria-hidden /> Read a payment advice</Button>
      {open && <AdviceDialog customer={customer} onClose={() => setOpen(false)} onUse={(p, s) => { onUse(p, s); setOpen(false); }} />}
    </>
  );
}

function AdviceDialog({ customer, onClose, onUse }: { customer?: string; onClose: () => void; onUse: (placed: AdvicePlaced, aiSuggestion: string | null) => void }) {
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AdviceResult | null>(null);

  const read = async (files?: FileList | null) => {
    const list = files ? Array.from(files).slice(0, 4) : [];
    if (!list.length && !text.trim()) return;
    setBusy(true);
    try {
      setResult(await accountsService.readAdvice({ files: list, text: list.length ? undefined : text.trim(), customer }));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read the advice", "error");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const p = result?.placed;
  return (
    <Modal open onClose={onClose} title="Read a payment advice" width="max-w-2xl" confirmDirtyClose={false}>
      <div className="space-y-4">
        <input ref={ref} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" aria-label="Advice PDF or photo" onChange={(e) => read(e.target.files)} />
        {!result && (
          <>
            <p className="text-sm text-ink-600">The customer's remittance advice: its PDF or a photo, or paste the text of their mail. The invoices it settles are found among their open invoices.</p>
            <div className="flex flex-wrap gap-2">
              <Button loading={busy} onClick={() => ref.current?.click()}>Choose PDF or photo</Button>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink-600">Or paste the mail</span>
              <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-lg border border-ink-200 bg-surface p-2 text-sm" placeholder="We have remitted Rs 72,345 vide UTR … towards your invoices 701 and 702 …" />
            </label>
            <div className="flex justify-end"><Button variant="secondary" loading={busy} disabled={!text.trim()} onClick={() => read(null)}>Read the text</Button></div>
          </>
        )}

        {result && !p && (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
            <AlertTriangle className="h-4 w-4" aria-hidden /> {result.read.problem === "not_an_advice" ? "That does not look like a payment advice." : "The advice could not be read."}
          </p>
        )}

        {p && (
          <div className="space-y-3 text-sm" aria-label="What the advice says">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{p.customer?.name ?? result!.read.payerName ?? "Unknown payer"}</span>
              {p.customer
                ? <StatusChip tone={p.customer.matchedBy === "name" ? "warning" : "success"}>{p.customer.matchedBy === "gstin" ? "by GSTIN" : p.customer.matchedBy === "name" ? "by name — confirm" : "as chosen"}</StatusChip>
                : <StatusChip tone="danger">not on file</StatusChip>}
              <span className="ml-auto tabular-nums">₹{money(p.amount ?? 0)}{p.date ? ` · ${p.date}` : ""}{p.reference ? ` · ${p.reference}` : ""}</span>
            </div>
            {p.allocations.length > 0 && (
              <table className="w-full">
                <thead><tr className="text-xs text-ink-500 font-medium"><th className="text-left font-medium">Invoice</th><th className="text-right font-medium">Settles</th><th className="text-right font-medium">Paid</th><th className="text-right font-medium">TDS</th><th className="text-right font-medium">Discount</th></tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {p.allocations.map((a) => (
                    <tr key={a.doc}>
                      <td className="py-1">{a.docNo}</td>
                      <td className="py-1 text-right tabular-nums">₹{money(a.amount)}</td>
                      <td className="py-1 text-right tabular-nums">{a.paid != null ? `₹${money(a.paid)}` : "—"}</td>
                      <td className="py-1 text-right tabular-nums">{a.tds ? `₹${money(a.tds)}` : "—"}</td>
                      <td className="py-1 text-right tabular-nums">{a.discount ? `₹${money(a.discount)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {p.adjustments.length > 0 && <p className="text-ink-600">{p.adjustments.map((a) => `${ADJUSTMENT_WORDS[a.kind] ?? a.kind} ₹${money(a.amount)}`).join(" · ")}</p>}
            {p.unmatched.length > 0 && (
              <ul className="space-y-1 text-status-warning" aria-label="Not matched">
                {p.unmatched.map((u) => <li key={u.invoiceNo}>“{u.invoiceNo}”: {u.why}{u.paid != null ? ` (₹${money(u.paid)})` : ""}</li>)}
              </ul>
            )}
            {p.notes.length > 0 && <ul className="list-disc space-y-1 pl-5 text-ink-600">{p.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            {p.statementLine && (
              <p className="flex items-center gap-2 text-ink-600"><Landmark className="h-4 w-4 text-ink-400" aria-hidden /> On the {p.statementLine.accountName} statement: “{p.statementLine.narration}”{p.statementLine.byReference ? " — the same UTR" : ""}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setResult(null)}>Read another</Button>
              <Button disabled={!p.customer} onClick={() => onUse(p, result!.aiSuggestion)}>Fill the receipt</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
