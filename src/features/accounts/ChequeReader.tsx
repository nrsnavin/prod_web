import { useRef, useState } from "react";
import { AlertTriangle, Camera, Info, OctagonAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { money } from "./shared";
import type { ChequeResult, Flag } from "./types";

// ══════════════════════════════════════════════════════════════════
//  "READ A CHEQUE PHOTO"
//
//  A customer's cheque, photographed on the counter, read so the receipt
//  is not typed (api/accountsPapers.js /cheques/read): the number, the
//  bank, the date and the amount, with what the server checked — the
//  figure against the words, the date (dated ahead: a post-dated cheque,
//  held until then; more than three months old: the bank will not pay),
//  who it is made out to — and who paid. "Fill the receipt" fills the
//  form by cheque; the person checks it and posts it as any receipt.
// ══════════════════════════════════════════════════════════════════

const TONE: Record<Flag["severity"], "danger" | "warning" | "info"> = { danger: "danger", warning: "warning", info: "info" };
const ICON = { danger: OctagonAlert, warning: AlertTriangle, info: Info };

/** The server's checks on a cheque, worst first. */
export function ChequeChecks({ checks }: { checks: Flag[] }) {
  if (!checks.length) return null;
  const order = { danger: 0, warning: 1, info: 2 };
  return (
    <ul className="space-y-1" aria-label="Checks on the cheque">
      {[...checks].sort((a, b) => order[a.severity] - order[b.severity]).map((c) => {
        const I = ICON[c.severity];
        return (
          <li key={c.code + c.message} className={`flex items-start gap-2 ${c.severity === "danger" ? "text-status-danger" : c.severity === "warning" ? "text-status-warning" : "text-ink-600"}`}>
            <I className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>{c.message}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ChequeReader({ customer, onUse }: { customer?: string; onUse: (result: ChequeResult) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}><Camera className="h-4 w-4" aria-hidden /> Read a cheque photo</Button>
      {open && <ChequeDialog customer={customer} onClose={() => setOpen(false)} onUse={(r) => { onUse(r); setOpen(false); }} />}
    </>
  );
}

function ChequeDialog({ customer, onClose, onUse }: { customer?: string; onClose: () => void; onUse: (result: ChequeResult) => void }) {
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ChequeResult | null>(null);

  const read = async (files?: FileList | null) => {
    const list = files ? Array.from(files).slice(0, 2) : [];
    if (!list.length) return;
    setBusy(true);
    try {
      setResult(await accountsService.readCheque(list, customer));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read the cheque", "error");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const r = result;
  const d = r?.draft;
  return (
    <Modal open onClose={onClose} title="Read a cheque photo" width="max-w-xl" confirmDirtyClose={false}>
      <div className="space-y-4">
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="hidden" aria-label="Cheque photo" onChange={(e) => read(e.target.files)} />
        {!r && (
          <>
            <p className="text-sm text-ink-600">Photograph the front of the cheque, all of it, in good light. The number, bank, date and amount are read, and the amount in figures is checked against the words.</p>
            <Button loading={busy} onClick={() => ref.current?.click()}><Camera className="h-4 w-4" aria-hidden /> Take or choose a photo</Button>
          </>
        )}

        {r && !d && (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
            <AlertTriangle className="h-4 w-4" aria-hidden /> {r.read.problem === "not_a_cheque" ? "That does not look like a cheque." : "The cheque could not be read. Try a sharper photo."}
          </p>
        )}

        {r && d && (
          <div className="space-y-3 text-sm" aria-label="What the cheque says">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{r.customer?.name ?? r.read.drawer ?? "Who paid is not clear"}</span>
              {r.customer
                ? <StatusChip tone={r.customer.matchedBy === "name" ? "warning" : "success"}>{r.customer.matchedBy === "payer" ? "a payer you taught" : r.customer.matchedBy === "name" ? "by name: confirm" : "as chosen"}</StatusChip>
                : <StatusChip tone="danger">pick the customer</StatusChip>}
              <span className="ml-auto text-base font-semibold tabular-nums">{d.amount != null ? `₹${money(d.amount)}` : "No amount read"}</span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ink-600">
              <dt>Cheque</dt><dd className="tabular-nums">{d.cheque.number || "not read"}</dd>
              <dt>Dated</dt><dd>{d.cheque.date ? formatDate(d.cheque.date) : "not read"}{d.postDated ? <StatusChip tone="info" className="ml-2">post-dated</StatusChip> : null}</dd>
              <dt>Drawn on</dt><dd>{d.cheque.bank || "not read"}</dd>
              {r.read.amountWords ? <><dt>In words</dt><dd>“{r.read.amountWords}”</dd></> : null}
              {r.read.payee ? <><dt>Pay</dt><dd>{r.read.payee}</dd></> : null}
            </dl>
            <ChequeChecks checks={r.checks} />
            {r.duplicate && (
              <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-status-danger">
                Already entered as {r.duplicate.voucherNo} on {formatDate(r.duplicate.date)} for ₹{money(r.duplicate.amount)} ({r.duplicate.partyName}).
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setResult(null)}>Read another</Button>
              <Button onClick={() => onUse(r)}>Fill the receipt</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
