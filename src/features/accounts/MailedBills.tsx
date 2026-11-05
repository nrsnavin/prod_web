import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money } from "./shared";

// ══════════════════════════════════════════════════════════════════
//  BILLS BY MAIL — what came to the bills mailbox, read and matched
//  (services/billMailbox.js). Each opens as a scanned bill does: the
//  form filled in, the file beside it, every figure checked before it
//  is entered. Shown only when the mailbox is set up or something waits.
// ══════════════════════════════════════════════════════════════════

export function MailedBills() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: [ACCOUNTS_KEY, "bill-mailbox"], queryFn: accountsService.billMailboxStatus });
  const { data: bills } = useQuery({ queryKey: [ACCOUNTS_KEY, "mailed-bills"], queryFn: () => accountsService.mailedBills("new"), enabled: !!status.data && (status.data.configured || status.data.waiting > 0) });
  const [dismissing, setDismissing] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
  const read = useMutation({
    mutationFn: accountsService.readBillMailbox,
    onSuccess: (r) => { toast(r.bills ? `${r.bills} bill${r.bills === 1 ? "" : "s"} read from ${r.mails} mail${r.mails === 1 ? "" : "s"}` : "No new bills in the mailbox", "success"); refresh(); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not read the mailbox", "error"),
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => accountsService.dismissMailedBill(id, "Not a bill for the books"),
    onSuccess: () => { setDismissing(null); refresh(); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not dismiss it", "error"),
  });

  if (!status.data || (!status.data.configured && !status.data.waiting)) return null;
  const list = bills ?? [];

  return (
    <Card className="mb-4 p-4" aria-label="Bills by mail">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold"><Mail className="h-4 w-4 text-brand-600" aria-hidden /> Bills by mail <span className="text-sm font-normal text-ink-400">({list.length} to check)</span></h3>
        {status.data.configured && (
          <Button size="sm" variant="ghost" loading={read.isPending} onClick={() => read.mutate()}><RefreshCw className="h-4 w-4" aria-hidden /> Check the mailbox</Button>
        )}
      </div>
      <p className="text-xs text-ink-400">
        {status.data.configured ? `Bills mailed to ${status.data.mailbox} are read every ${status.data.everyMin} min.` : "The mailbox is not read on this server any more."} Open one to enter it — the form comes filled in, with the bill beside it.
      </p>
      {list.length > 0 && (
        <ul className="mt-3 divide-y divide-ink-100">
          {list.map((b) => (
            <li key={b._id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.supplierName || b.from}{b.billNo && <span className="font-normal text-ink-500"> · #{b.billNo}</span>}</p>
                <p className="truncate text-xs text-ink-400">
                  {b.from}{b.receivedAt ? ` · ${formatDate(b.receivedAt)}` : ""} · {b.filename}
                </p>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {b.supplier
                    ? <StatusChip tone="success">{b.matchedBy === "gstin" ? "supplier by GSTIN" : "supplier by name — confirm"}</StatusChip>
                    : <StatusChip tone="warning">supplier not on file</StatusChip>}
                  {b.senderKnown && <StatusChip tone="info">from the supplier's address</StatusChip>}
                  {b.alreadyEntered && <StatusChip tone="danger">already entered as {b.alreadyEntered}</StatusChip>}
                  {b.confidence != null && b.confidence < 0.6 && <StatusChip tone="warning">hard to read</StatusChip>}
                </span>
              </div>
              <span className="tabular-nums">{b.grand != null ? `₹${money(b.grand)}` : "—"}</span>
              <span className="flex gap-1">
                <a className="rounded-lg px-2 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100" href={accountsService.mailedBillFileUrl(b._id)} target="_blank" rel="noreferrer">View</a>
                <Link className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700" to={`/accounts/bills?mailed=${b._id}`}>Open as a bill</Link>
                {dismissing === b._id ? (
                  <Button size="sm" variant="danger" loading={dismiss.isPending} onClick={() => dismiss.mutate(b._id)}>Not ours — dismiss</Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setDismissing(b._id)}>Dismiss</Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
