import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusChip, type ChipTone } from "@/components/ui/StatusChip";
import { httpClient } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";

// ══════════════════════════════════════════════════════════════════
//  CUSTOMER MAIL
//
//  Each mail from the customer mailbox, sorted and handed to its reader:
//  an order request to confirm, a complaint opened, a payment advice
//  placed on the books, a quote drafted. What could not be finished —
//  an unknown sender, a job that is not clear — waits here for a person.
// ══════════════════════════════════════════════════════════════════

export interface CustomerMailRow {
  _id: string; from: string; subject: string; receivedAt: string; customerName: string;
  kind: "purchase_order" | "complaint" | "payment_advice" | "enquiry" | "other";
  summary: string; status: "new" | "done" | "dismissed" | "skipped"; note: string;
  orderRequest?: string | null; complaint?: string | null; files: { filename: string }[];
  /** Mailed, or a photo sent on WhatsApp. */
  source?: "mail" | "whatsapp";
}
const KIND: Record<CustomerMailRow["kind"], { label: string; tone: ChipTone }> = {
  purchase_order: { label: "Order", tone: "info" }, complaint: { label: "Complaint", tone: "danger" },
  payment_advice: { label: "Payment advice", tone: "success" }, enquiry: { label: "Enquiry", tone: "warning" }, other: { label: "Other", tone: "neutral" },
};
const NEXT: Partial<Record<CustomerMailRow["kind"], { to: string; label: string }>> = {
  purchase_order: { to: "/orders", label: "Confirm under Orders" },
  complaint: { to: "/complaints", label: "Open complaints" },
  payment_advice: { to: "/accounts/collections", label: "Enter the receipt" },
  enquiry: { to: "/quotes/new", label: "Make the quote" },
};

export const customerMailService = {
  list: () => httpClient.get<{ rows: CustomerMailRow[] }>("/accounts/customer-mail"),
  status: () => httpClient.get<{ configured: boolean; mailbox: string; everyMin: number }>("/accounts/customer-mail/status"),
  act: (id: string, action: "dismiss" | "done") => httpClient.post(`/accounts/customer-mail/${id}/${action}`, {}),
};

export function CustomerMail() {
  const qc = useQueryClient();
  const [all, setAll] = useState(false);
  const status = useQuery({ queryKey: ["customer-mail", "status"], queryFn: customerMailService.status });
  // Orders and advices sent on WhatsApp come here too, mailbox or not.
  const list = useQuery({ queryKey: ["customer-mail"], queryFn: customerMailService.list, enabled: !!status.data });
  const act = useMutation({ mutationFn: ({ id, action }: { id: string; action: "dismiss" | "done" }) => customerMailService.act(id, action), onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-mail"] }) });

  const rows = list.data?.rows ?? [];
  if (!status.data || (!status.data.configured && !rows.length)) return null;
  const waiting = rows.filter((r) => r.status === "new");
  const shown = all ? rows : waiting;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold"><Inbox className="h-4 w-4 text-brand-500" /> Customer mail <StatusChip tone={waiting.length ? "info" : "neutral"}>{waiting.length} to look at</StatusChip></h3>
        <button className="text-sm text-brand-600 hover:underline" onClick={() => setAll((v) => !v)}>{all ? "Only what is waiting" : `Show handled too (${rows.length - waiting.length})`}</button>
      </div>
      <p className="text-xs text-ink-500">{status.data.configured ? `Read from ${status.data.mailbox} every ${status.data.everyMin} min, with photos sent on WhatsApp` : "Photos of orders and advices sent on WhatsApp"}: orders become order requests, complaints are opened when the job is clear, advices and enquiries are read for you to finish.</p>
      {shown.length === 0 ? <p className="mt-2 text-sm text-ink-400">Nothing waiting.</p> : (
        <ul className="mt-2 divide-y divide-ink-100 text-sm">
          {shown.map((r) => (
            <li key={r._id} className="flex flex-wrap items-start justify-between gap-2 py-2">
              <div className="min-w-0">
                <StatusChip tone={KIND[r.kind].tone}>{KIND[r.kind].label}</StatusChip>{" "}
                {r.source === "whatsapp" && <><StatusChip tone="neutral">WhatsApp</StatusChip>{" "}</>}
                <span className="font-medium">{r.customerName || r.from}</span>
                <span className="text-ink-500"> · {formatDate(r.receivedAt)} · {r.subject}</span>
                {r.summary && <p className="text-ink-600">{r.summary}</p>}
                {r.note && <p className="text-xs text-ink-500">{r.note}{r.files.length ? ` · ${r.files.map((f) => f.filename).join(", ")}` : ""}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                {NEXT[r.kind] && <Link to={NEXT[r.kind]!.to} className="rounded-md px-2 py-1 text-brand-600 hover:bg-ink-100">{NEXT[r.kind]!.label}</Link>}
                {r.status === "new" && <Button size="sm" variant="secondary" onClick={() => act.mutate({ id: r._id, action: "done" })}>Done</Button>}
                {r.status !== "dismissed" && <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: r._id, action: "dismiss" })}>Dismiss</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
