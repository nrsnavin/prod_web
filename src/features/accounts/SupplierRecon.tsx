import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Scale } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { money } from "./shared";
import type { SupplierReconResult } from "./types";

// ══════════════════════════════════════════════════════════════════
//  "CHECK THEIR STATEMENT" — a supplier's ledger of our account set
//  beside ours (api/accounts.js /supplier-recon): what agrees, what only
//  they have, what only we have, and how much of the balance difference
//  that explains. Nothing is changed; each line says what to do.
// ══════════════════════════════════════════════════════════════════

const amt = (e: { debit: number; credit: number }) => `₹${money(e.debit || e.credit)}`;

export function SupplierRecon({ supplier, name }: { supplier: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><Scale className="h-4 w-4" aria-hidden /> Check their statement</Button>
      {open && <ReconDialog supplier={supplier} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReconDialog({ supplier, name, onClose }: { supplier: string; name: string; onClose: () => void }) {
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SupplierReconResult | null>(null);

  const read = async (files: FileList | null) => {
    const list = files ? Array.from(files).slice(0, 6) : [];
    if (!list.length) return;
    setBusy(true);
    try { setResult(await accountsService.reconcileSupplier(supplier, list)); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not read their statement", "error"); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  const r = result?.recon;

  return (
    <Modal open onClose={onClose} title={`${name}'s statement against our books`} width="max-w-4xl" confirmDirtyClose={false}>
      <div className="space-y-4 text-sm">
        <input ref={ref} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp,.xlsx,.csv" className="hidden" aria-label="Their statement" onChange={(e) => read(e.target.files)} />
        {!result && (
          <div className="rounded-lg border border-dashed border-ink-300 p-6 text-center">
            <p className="text-ink-600">The statement of our account they sent: PDF, photos of it, or their Excel / CSV. Every entry is set beside ours.</p>
            <Button className="mt-3" loading={busy} onClick={() => ref.current?.click()}>Choose their statement</Button>
          </div>
        )}
        {result && !r && (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-status-warningBg px-3 py-2 text-status-warning"><AlertTriangle className="h-4 w-4" aria-hidden /> {result.read.problem === "not_a_statement" ? "That does not look like a statement of account." : "Their statement could not be read."}</p>
        )}
        {r && (
          <>
            <section aria-label="Balances" className="grid gap-3 rounded-lg bg-surface-muted p-3 sm:grid-cols-4">
              <div><p className="text-xs text-ink-400">Period</p><p>{formatDate(r.period.from)} – {formatDate(r.period.to)}</p></div>
              <div><p className="text-xs text-ink-400">They say we owe</p><p className="tabular-nums font-semibold">{r.balances.theirs != null ? `₹${money(r.balances.theirs)}` : "—"}</p></div>
              <div><p className="text-xs text-ink-400">Our books say</p><p className="tabular-nums font-semibold">₹{money(r.balances.ours)}</p></div>
              <div>
                <p className="text-xs text-ink-400">Difference</p>
                <p className="tabular-nums font-semibold">{r.balances.difference != null ? `₹${money(r.balances.difference)}` : "—"}</p>
                {r.balances.unexplained != null && (Math.abs(r.balances.unexplained) < 1
                  ? <p className="flex items-center gap-1 text-xs text-status-success"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> all explained below</p>
                  : <p className="text-xs text-status-warning">₹{money(r.balances.unexplained)} not explained</p>)}
              </div>
            </section>
            {r.gstinDiffers && <p className="text-status-warning">The GSTIN on their statement is not the one on file for {name}.</p>}

            {r.onlyTheirs.length > 0 && (
              <section aria-label="Only in theirs">
                <h4 className="mb-1 font-semibold">Only in their statement ({r.onlyTheirs.length})</h4>
                <ul className="divide-y divide-ink-100">
                  {r.onlyTheirs.map((e, i) => (
                    <li key={`t${i}`} className="flex flex-wrap items-center gap-2 py-1.5">
                      <span className="w-24 text-ink-500">{e.date ? formatDate(e.date) : "—"}</span>
                      <span className="font-medium">{e.docNo || e.kind.replace("_", " ")}</span>
                      <span className="text-ink-500">{e.likely}</span>
                      <span className="ml-auto tabular-nums">{amt(e)}</span>
                      {e.kind === "invoice" && <Link className="text-xs font-medium text-brand-600 hover:underline" to="/accounts/bills?scan=1">Enter it</Link>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {r.onlyOurs.length > 0 && (
              <section aria-label="Only in ours">
                <h4 className="mb-1 font-semibold">Only in our books ({r.onlyOurs.length})</h4>
                <ul className="divide-y divide-ink-100">
                  {r.onlyOurs.map((o) => (
                    <li key={o.doc} className="flex flex-wrap items-center gap-2 py-1.5">
                      <span className="w-24 text-ink-500">{formatDate(o.date)}</span>
                      <span className="font-medium">{o.docNo}{o.theirNo ? ` (${o.theirNo})` : ""}</span>
                      <span className="text-ink-500">{o.likely}</span>
                      <span className="ml-auto tabular-nums">{amt(o)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section aria-label="Agreed">
              <h4 className="mb-1 font-semibold">Agreed ({r.matched.length})</h4>
              <ul className="divide-y divide-ink-100">
                {r.matched.map((m, i) => (
                  <li key={`m${i}`} className="flex flex-wrap items-center gap-2 py-1.5">
                    <span className="w-24 text-ink-500">{m.theirs.date ? formatDate(m.theirs.date) : "—"}</span>
                    <span className="font-medium">{m.theirs.docNo || m.theirs.kind}{m.alsoTheirs ? ` + ${m.alsoTheirs.docNo || m.alsoTheirs.kind}` : ""}</span>
                    <span className="text-ink-500">= {m.ours.map((o) => o.docNo).join(", ")}</span>
                    {m.timing && <StatusChip tone="info">booked by us after their period</StatusChip>}
                    {Math.abs(m.difference) >= 1 && <StatusChip tone="warning">₹{money(Math.abs(m.difference))} {m.difference > 0 ? "more" : "less"} on theirs</StatusChip>}
                    <span className="ml-auto tabular-nums">{amt(m.theirs)}{m.alsoTheirs ? ` + ${amt(m.alsoTheirs)}` : ""}</span>
                  </li>
                ))}
              </ul>
            </section>
            <div className="flex justify-end"><Button variant="secondary" onClick={() => setResult(null)}>Check another</Button></div>
          </>
        )}
      </div>
    </Modal>
  );
}
