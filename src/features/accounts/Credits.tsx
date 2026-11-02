import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { round2 } from "@/features/invoices/gst";
import { useAccountsMutations, useCredits, useOpenDocs } from "./hooks";
import { money } from "./shared";
import type { Credit, OpenDoc } from "./types";

/** Which documents a credit can be set against. */
function targetsFor(credit: Credit, partyType: "customer" | "supplier"): OpenDoc["docType"][] {
  if (partyType === "customer") return ["Invoice", "OpeningBalance"];
  return credit.sourceType === "AccountNote" ? ["SupplierBill", "OpeningBalance"] : ["SupplierBill", "Expense", "OpeningBalance"];
}

/**
 * Set some of what a party has on account — an advance, an unapplied
 * note, an opening advance — against its open documents. Oldest first
 * is filled in; any line can be changed.
 */
export function ApplyCreditDialog({ credit, partyType, party, onClose }: { credit: Credit; partyType: "customer" | "supplier"; party: string; onClose: () => void }) {
  const { toast } = useToast();
  const { applyCredit } = useAccountsMutations();
  const { data, isLoading } = useOpenDocs(partyType, party);
  const allowed = targetsFor(credit, partyType);
  const docs = useMemo(() => (data?.docs ?? []).filter((d) => allowed.includes(d.docType)).sort((a, b) => a.date.localeCompare(b.date)), [data, allowed]);
  const [picked, setPicked] = useState<Record<string, number | "">>({});
  const total = round2(Object.values(picked).reduce<number>((s, v) => s + (Number(v) || 0), 0));
  const over = docs.filter((d) => picked[d.id] !== undefined && Number(picked[d.id]) > d.outstanding + 0.005);
  const problems = [
    ...over.map((d) => `${d.docNo} has only ₹${money(d.outstanding)} outstanding`),
    ...(total > credit.available + 0.005 ? [`Only ₹${money(credit.available)} is available on ${credit.docNo}`] : []),
  ];
  const tick = (d: OpenDoc, on: boolean) => setPicked((p) => {
    const next = { ...p };
    if (!on) { delete next[d.id]; return next; }
    const used = Object.entries(next).reduce((s, [, v]) => s + (Number(v) || 0), 0);
    next[d.id] = round2(Math.max(0, Math.min(d.outstanding, credit.available - used)));
    return next;
  });
  const submit = () =>
    applyCredit.mutate(
      { source: { type: credit.sourceType, id: credit.id }, allocations: docs.filter((d) => Number(picked[d.id]) > 0).map((d) => ({ docType: d.docType, doc: d.id, amount: Number(picked[d.id]) })) },
      { onSuccess: (r) => { toast(`₹${money(r.applied)} of ${credit.docNo} applied`, "success"); onClose(); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not apply", "error") }
    );

  return (
    <Modal open onClose={onClose} title={`Apply ${credit.docNo}`} width="max-w-3xl">
      <p className="text-sm text-ink-500">{credit.label} · ₹{money(credit.available)} available of ₹{money(credit.amount)}</p>
      {isLoading ? <Skeleton className="mt-3 h-24 w-full" /> : docs.length === 0 ? (
        <p className="mt-3 text-sm text-ink-400">Nothing open to set it against yet. It stays on account.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400"><th className="py-2" /><th className="py-2 text-left font-medium">Document</th><th className="py-2 text-left font-medium">Date</th><th className="py-2 text-right font-medium">Outstanding</th><th className="py-2 text-right font-medium">Apply</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="py-1.5 pr-2"><input type="checkbox" aria-label={`Apply to ${d.docNo}`} checked={picked[d.id] !== undefined} onChange={(e) => tick(d, e.target.checked)} /></td>
                  <td className="py-1.5 pr-2 font-medium">{d.docNo}{d.refNo ? <span className="font-normal text-ink-400"> · {d.refNo}</span> : null}</td>
                  <td className="py-1.5 pr-2 text-ink-500">{formatDate(d.date)}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(d.outstanding)}</td>
                  <td className="py-1.5 text-right"><Input aria-label={`Apply amount for ${d.docNo}`} type="number" step="0.01" min={0} className="w-32 text-right" disabled={picked[d.id] === undefined} value={picked[d.id] ?? ""} onChange={(e) => setPicked((p) => ({ ...p, [d.id]: e.target.value === "" ? "" : Number(e.target.value) }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {problems.map((p) => <p key={p} className="mt-2 text-sm text-status-danger">{p}</p>)}
      <div className="mt-4 flex items-center justify-end gap-3">
        <span className="text-sm text-ink-500">Applying <span className="font-semibold tabular-nums text-ink-900">₹{money(total)}</span></span>
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button onClick={submit} disabled={total <= 0 || problems.length > 0} loading={applyCredit.isPending}>Apply</Button>
      </div>
    </Modal>
  );
}

/** A party's credits on account, each with an Apply button. Renders nothing when there are none. */
export function CreditsCard({ partyType, party, credits: given }: { partyType: "customer" | "supplier"; party: string; credits?: Credit[] }) {
  const { data } = useCredits(given ? undefined : partyType, given ? undefined : party);
  const credits = given ?? data ?? [];
  const [applying, setApplying] = useState<Credit | null>(null);
  if (!credits.length) return null;
  const total = round2(credits.reduce((s, c) => s + c.available, 0));
  return (
    <Card className="border-status-info/40 p-4">
      <p className="text-sm font-semibold">On account: ₹{money(total)} {partyType === "customer" ? "received ahead or credited" : "paid ahead or debited"}, not yet set against a document</p>
      <ul className="mt-2 divide-y divide-ink-100 text-sm">
        {credits.map((c) => (
          <li key={`${c.sourceType}-${c.id}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <span><span className="font-medium">{c.docNo}</span><span className="text-ink-400"> · {c.label} · {formatDate(c.date)}</span></span>
            <span className="flex items-center gap-2"><span className="tabular-nums">₹{money(c.available)}</span><Button size="sm" variant="secondary" onClick={() => setApplying(c)}>Apply</Button></span>
          </li>
        ))}
      </ul>
      {applying && <ApplyCreditDialog credit={applying} partyType={partyType} party={party} onClose={() => setApplying(null)} />}
    </Card>
  );
}
