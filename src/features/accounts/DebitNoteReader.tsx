import { useState } from "react";
import { FileScan } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { money } from "./shared";
import { PaperChecks, PaperPicker, ReadProblem } from "./PaperReader";
import type { DebitNoteResult } from "./types";

// ══════════════════════════════════════════════════════════════════
//  "READ THE CUSTOMER'S DEBIT NOTE"
//
//  A customer debits us (goods short, rejected, a rate difference) or
//  writes that they paid an invoice short and why. The paper is read
//  (api/accountsPapers.js /debit-notes/read): who it is from, the invoice
//  it names among theirs, the amount before GST at that invoice's rate,
//  and what is still open to credit on it after the notes already issued.
//  "Fill the credit note" puts all of that in the form; the person checks
//  it and issues it as any credit note.
// ══════════════════════════════════════════════════════════════════

export function DebitNoteReader({ customer, onUse }: { customer?: string; onUse: (result: DebitNoteResult) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}><FileScan className="h-4 w-4" aria-hidden /> Read the customer's debit note</Button>
      {open && <DebitNoteDialog customer={customer} onClose={() => setOpen(false)} onUse={(r) => { onUse(r); setOpen(false); }} />}
    </>
  );
}

const MATCHED: Record<NonNullable<DebitNoteResult["customer"]>["matchedBy"], string> = { gstin: "by GSTIN", name: "by name: confirm", picked: "as chosen" };

function DebitNoteDialog({ customer, onClose, onUse }: { customer?: string; onClose: () => void; onUse: (result: DebitNoteResult) => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DebitNoteResult | null>(null);

  const read = async (files: File[]) => {
    setBusy(true);
    try { setResult(await accountsService.readDebitNote(files, customer)); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not read the debit note", "error"); }
    finally { setBusy(false); }
  };

  const r = result;
  const d = r?.draft;
  const blocked = !!r?.checks.some((c) => c.severity === "danger");
  return (
    <Modal open onClose={onClose} title="Read the customer's debit note" width="max-w-xl" confirmDirtyClose={false}>
      <div className="space-y-4">
        {!r && (
          <>
            <p className="text-sm text-ink-600">Their debit note, or the letter saying what they paid short and why: a photo or the PDF they sent, up to three pages. The invoice it names is found among theirs and the credit note drafted against it, before GST at the invoice's rate.</p>
            <PaperPicker label="Debit note photo" max={3} busy={busy} onFiles={read} />
          </>
        )}

        {r?.read.problem && <ReadProblem>{r.read.problem === "not_a_debit_note" ? "That does not look like a debit note or a short-payment letter." : "The paper could not be read. Try a sharper photo or the PDF."}</ReadProblem>}

        {r && !r.read.problem && (
          <div className="space-y-3 text-sm" aria-label="What the debit note says">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{r.customer?.name ?? r.read.customerName ?? "Who sent it is not clear"}</span>
              {r.customer ? <StatusChip tone={r.customer.matchedBy === "name" ? "warning" : "success"}>{MATCHED[r.customer.matchedBy]}</StatusChip> : <StatusChip tone="danger">pick the customer</StatusChip>}
              <span className="ml-auto text-base font-semibold tabular-nums">{d ? `₹${money(d.totals.grand)}` : r.read.total != null ? `₹${money(r.read.total)}` : "No amount read"}</span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ink-600">
              <dt>Paper</dt><dd>{r.read.kind === "short_payment" ? "Short-payment letter" : "Debit note"}{r.read.noteNo ? ` ${r.read.noteNo}` : ""}{r.read.date ? `, ${formatDate(r.read.date)}` : ""}</dd>
              <dt>Against</dt><dd>{r.invoice ? <>{r.invoice.invoiceNumber} of {formatDate(r.invoice.invoiceDate)}, ₹{money(r.invoice.grand)}</> : (r.read.invoices?.join(", ") || "no invoice named")}</dd>
              {r.read.reason ? <><dt>Reason</dt><dd>{r.read.reason}</dd></> : null}
              {d ? <><dt>Credit</dt><dd className="tabular-nums">₹{money(d.totals.taxable)} {d.financial ? "(no GST: past the time limit)" : `+ GST ₹${money(d.totals.gst)}`} <span className="text-ink-400">· {d.basis}</span></dd></> : null}
              {r.notesSoFar && r.notesSoFar.notes.length > 0 ? <><dt>Credited so far</dt><dd>₹{money(r.notesSoFar.credited)} ({r.notesSoFar.notes.map((n) => n.noteNo).join(", ")}) · ₹{money(r.notesSoFar.left)} still open</dd></> : null}
            </dl>
            <PaperChecks checks={r.checks} label="Checks on the debit note" />
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setResult(null)}>Read another</Button>
              <Button onClick={() => onUse(r)} disabled={!r.customer && !d}>{blocked ? "Fill it in anyway" : "Fill the credit note"}</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
