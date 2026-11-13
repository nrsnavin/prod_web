import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusChip, type ChipTone } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money } from "./shared";
import type { ChequeResult, PaperKind, WhatsAppPaper } from "./types";

// ══════════════════════════════════════════════════════════════════
//  PHOTOS FROM WHATSAPP
//
//  Every photo sent to the WhatsApp number is sorted and handed to the
//  reader for it (services/whatsappPapers.js): a slip to the slip reader,
//  a bill or receipt to "Bills by mail", an order or advice to customer
//  mail. What waits here is what a person still has to do something
//  with: a cheque to enter as a receipt, a supplier's challan to receive
//  on its PO, a photo nobody could tell. A wrong sort is put right here
//  (or by a reply on WhatsApp: "BILL 4821").
// ══════════════════════════════════════════════════════════════════

export const PAPER_KINDS: Record<PaperKind, { label: string; tone: ChipTone }> = {
  production_slip: { label: "Production slip", tone: "neutral" },
  supplier_bill: { label: "Supplier's bill", tone: "info" },
  expense_receipt: { label: "Receipt", tone: "info" },
  cheque: { label: "Cheque", tone: "success" },
  delivery_challan: { label: "Challan", tone: "warning" },
  purchase_order: { label: "Purchase order", tone: "info" },
  payment_advice: { label: "Payment advice", tone: "success" },
  other: { label: "Not sorted", tone: "danger" },
};
const SEND_AS: Array<{ value: PaperKind; label: string }> = [
  { value: "supplier_bill", label: "a supplier's bill" },
  { value: "expense_receipt", label: "a receipt (expense)" },
  { value: "cheque", label: "a cheque" },
  { value: "delivery_challan", label: "a delivery challan" },
  { value: "production_slip", label: "a production slip" },
  { value: "purchase_order", label: "a customer's purchase order" },
  { value: "payment_advice", label: "a payment advice" },
];

const isCheque = (p: WhatsAppPaper): p is WhatsAppPaper & { result: ChequeResult } => p.kind === "cheque" && !!p.result && "draft" in p.result && !!p.result.draft;
const isChallan = (p: WhatsAppPaper) => p.kind === "delivery_challan" && !!p.result && "rows" in p.result;

/** What was read, in a line. */
function readLine(p: WhatsAppPaper): string {
  if (isCheque(p)) {
    const r = p.result;
    const d = r.draft!;
    return [`Cheque ${d.cheque.number || "(number not read)"}`, r.customer?.name || r.read.drawer, d.amount != null ? `₹${money(d.amount)}` : null, d.cheque.date ? `dated ${formatDate(d.cheque.date)}${d.postDated ? " (post-dated)" : ""}` : null].filter(Boolean).join(" · ");
  }
  if (isChallan(p)) {
    const r = p.result as { read: { supplierName?: string; dcNo?: string }; po: { poNo: number } | null; rows: unknown[] };
    return [r.read.supplierName ? `From ${r.read.supplierName}` : "Challan", r.read.dcNo ? `DC ${r.read.dcNo}` : null, r.po ? `PO #${r.po.poNo}` : "PO not found", `${r.rows.length} line${r.rows.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
  }
  return p.summary || p.caption || "";
}

export function WhatsAppPhotos() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [all, setAll] = useState(false);
  const list = useQuery({ queryKey: [ACCOUNTS_KEY, "whatsapp-papers", all], queryFn: () => accountsService.whatsappPapers(all ? "all" : "waiting") });
  const refresh = () => { qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "whatsapp-papers"] }); qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "inbox"] }); };
  const route = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: PaperKind }) => accountsService.routeWhatsappPaper(id, kind),
    onSuccess: (p) => { toast(`Photo ${p.code} sent on as ${PAPER_KINDS[p.kind ?? "other"].label.toLowerCase()}`, "success"); refresh(); },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not send it on", "error"),
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => accountsService.dismissWhatsappPaper(id, "Not for the books"),
    onSuccess: (p) => { toast(`Photo ${p.code} set aside`, "success"); refresh(); },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not set it aside", "error"),
  });

  const papers = list.data?.papers ?? [];
  const waiting = list.data?.waiting ?? 0;
  if (!list.data || (!all && !papers.length)) return null;

  return (
    <Card className="p-4" aria-label="Photos from WhatsApp">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold"><MessageCircle className="h-4 w-4 text-brand-500" aria-hidden /> Photos from WhatsApp <StatusChip tone={waiting ? "info" : "neutral"}>{waiting} to look at</StatusChip></h3>
        <button className="text-sm text-brand-600 hover:underline" onClick={() => setAll((v) => !v)}>{all ? "Only what is waiting" : "Show all photos"}</button>
      </div>
      <p className="text-xs text-ink-500">Each photo sent to the WhatsApp number is sorted and sent where it belongs. Here: cheques to enter, challans to receive, and photos nobody could tell.</p>
      {papers.length === 0 ? <p className="mt-2 text-sm text-ink-400">No photos yet.</p> : (
        <ul className="mt-2 divide-y divide-ink-100 text-sm">
          {papers.map((p) => {
            const kind = PAPER_KINDS[p.kind ?? "other"];
            const challanPo = isChallan(p) ? (p.result as { po: { _id: string; poNo: number } | null }).po : null;
            return (
              <li key={p._id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <div className="min-w-0">
                  <StatusChip tone={kind.tone}>{kind.label}</StatusChip>{" "}
                  <span className="font-medium">{p.sentByName || p.from}</span>
                  <span className="text-ink-500"> · {formatDate(p.createdAt)} · #{p.code}{p.status !== "waiting" ? ` · ${p.status}` : ""}</span>
                  {readLine(p) && <p className="text-ink-600">{readLine(p)}</p>}
                  {isCheque(p) && p.result.checks.filter((c) => c.severity === "danger").map((c) => <p key={c.code} className="text-xs text-status-danger">{c.message}</p>)}
                  {(p.note || p.sentTo || p.entered) && <p className="text-xs text-ink-500">{[p.note, p.entered ? `Entered as ${p.entered.label}` : p.sentTo ? `Sent to: ${p.sentTo.label}` : ""].filter(Boolean).join(" · ")}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <a href={accountsService.whatsappPaperFileUrl(p._id)} target="_blank" rel="noreferrer" className="rounded-md px-2 py-1 text-brand-600 hover:bg-ink-100">Photo</a>
                  {p.status === "waiting" && isCheque(p) && <Link to={`/accounts/vouchers?new=receipt&paper=${p._id}`} className="rounded-md px-2 py-1 text-brand-600 hover:bg-ink-100">Enter the receipt</Link>}
                  {p.status === "waiting" && challanPo && <Link to={`/purchase-orders/${challanPo._id}?paper=${p._id}`} className="rounded-md px-2 py-1 text-brand-600 hover:bg-ink-100">Receive on PO #{challanPo.poNo}</Link>}
                  {["waiting", "done", "failed"].includes(p.status) && !p.entered && (
                    <Select aria-label={`Photo ${p.code} is`} className="w-48" value="" disabled={route.isPending}
                      onChange={(e) => e.target.value && route.mutate({ id: p._id, kind: e.target.value as PaperKind })}
                      options={[{ value: "", label: p.kind === "other" ? "It is…" : "It is something else…" }, ...SEND_AS.filter((o) => o.value !== p.kind || p.status === "failed")]} />
                  )}
                  {(p.status === "waiting" || p.status === "failed") && <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(p._id)}>Set aside</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
