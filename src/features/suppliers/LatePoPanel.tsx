import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, MessageCircle, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { httpClient } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";

// ══════════════════════════════════════════════════════════════════
//  LATE DELIVERIES
//
//  Open POs past the date we asked for: what is still to come, the
//  customer order each one holds up, and the chaser to the supplier —
//  sent from here, or opened in WhatsApp to send by hand. The supplier's
//  reply comes back onto the PO as their promised date.
// ══════════════════════════════════════════════════════════════════

export interface LatePo {
  _id: string; poNo: number; expectedDate: string; daysLate: number;
  supplier: { name: string; phone: string };
  pending: { material: string; unit: string; pending: number; belowMinimum: boolean }[];
  forOrder: { orderNo: number; supplyDate: string } | null;
  promisedDate: string | null; chaseCount: number; lastChasedAt: string | null;
  history: { at: string; kind: "sent" | "reply"; text: string; read?: { kind?: string; summary?: string } }[];
  state: "overdue" | "promised"; chaseDue: boolean; why: string; atRisk: boolean; draft: string; waLink: string;
}
interface ChaseSettings { auto: boolean; hour: number; gapDays: number; acknowledge: boolean }

export const latePoService = {
  list: () => httpClient.get<{ rows: LatePo[]; settings: ChaseSettings }>("/supplier/po/chase"),
  send: (id: string) => httpClient.post<{ sent: boolean; dryRun: boolean; error?: string }>(`/supplier/po/${id}/chase`, {}),
  sendDue: () => httpClient.post<{ sent: { poNo: number; sent: boolean }[] }>("/supplier/po/chase/send-due", {}),
  settings: (body: Partial<ChaseSettings>) => httpClient.put("/supplier/po/chase/settings", body),
};

export function LatePoPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["po-chase"], queryFn: latePoService.list });
  const refresh = () => qc.invalidateQueries({ queryKey: ["po-chase"] });
  const send = useMutation({
    mutationFn: latePoService.send,
    onSuccess: (r) => { toast(r.sent ? "Chaser sent" : r.dryRun ? "WhatsApp is not set up — open it in WhatsApp instead" : r.error || "Not sent", r.sent ? "success" : "info"); refresh(); },
    onError: (e) => toast(e instanceof Error ? e.message : "Not sent", "error"),
  });
  const sendDue = useMutation({
    mutationFn: latePoService.sendDue,
    onSuccess: (r) => { toast(`${r.sent.filter((x) => x.sent).length} chaser${r.sent.length === 1 ? "" : "s"} sent`, "success"); refresh(); },
  });
  const settings = useMutation({ mutationFn: latePoService.settings, onSuccess: refresh });

  const rows = data?.rows ?? [];
  if (!rows.length) return null;
  const due = rows.filter((r) => r.chaseDue).length;
  const s = data?.settings;

  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Late deliveries ({rows.length})</h3>
          <p className="text-xs text-ink-500">Open POs past the date asked for. Suppliers' replies come back here as their promised date.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {s && (
            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input type="checkbox" checked={s.auto} onChange={(e) => settings.mutate({ auto: e.target.checked })} />
              Send chasers each morning at {s.hour}:00
            </label>
          )}
          <Button size="sm" disabled={!due} loading={sendDue.isPending} onClick={() => sendDue.mutate()}>
            <Send className="h-4 w-4" /> Send {due} due
          </Button>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-ink-100">
        {rows.map((r) => (
          <li key={r._id} className="py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <Link to={`/purchase-orders/${r._id}`} className="font-medium text-brand-600 hover:underline">PO #{r.poNo}</Link>{" "}
                · {r.supplier.name} · <span className="text-status-danger">{r.daysLate} day{r.daysLate === 1 ? "" : "s"} late</span>
                {r.state === "promised" && r.promisedDate && <StatusChip tone="info" className="ml-2">Promised {formatDate(r.promisedDate)}</StatusChip>}
                {r.atRisk && r.forOrder && (
                  <span className="ml-2 inline-flex items-center gap-1 text-status-warning"><AlertTriangle className="h-3.5 w-3.5" /> Order #{r.forOrder.orderNo} due {formatDate(r.forOrder.supplyDate)}</span>
                )}
                <p className="text-ink-500">
                  {r.pending.map((p) => `${p.material} ${p.pending.toLocaleString("en-IN")} ${p.unit}`).join(" · ")}
                  {r.chaseCount ? ` · chased ${r.chaseCount}×` : ""}{r.why ? ` · ${r.why}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setOpen(open === r._id ? null : r._id)}>{open === r._id ? "Hide" : "Message"}</Button>
                {r.waLink && <a href={r.waLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-ink-600 hover:bg-ink-100"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
                <Button size="sm" variant="secondary" disabled={!r.supplier.phone || r.state === "promised"} loading={send.isPending && send.variables === r._id} onClick={() => send.mutate(r._id)}>Send chaser</Button>
              </div>
            </div>
            {open === r._id && (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <pre className="whitespace-pre-wrap rounded-md bg-ink-50 p-2 text-xs text-ink-700">{r.draft}</pre>
                <ul className="space-y-1 text-xs">
                  {r.history.length === 0 && <li className="text-ink-400">Not chased yet.</li>}
                  {r.history.map((h, i) => (
                    <li key={i}><span className="text-ink-400">{formatDate(h.at)} · {h.kind === "sent" ? "Sent" : "Reply"}:</span> {h.kind === "reply" ? `“${h.text}”${h.read?.summary ? ` — ${h.read.summary}` : ""}` : "chaser"}</li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
