import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Mail, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money } from "./shared";
import type { ReadyMailedBill } from "./types";

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

  // Ready bills: fetched with the bodies the bill route takes, shown for a
  // last look, then entered one by one through that route and its checks.
  const [ready, setReady] = useState<ReadyMailedBill[] | null>(null);
  const [entering, setEntering] = useState(false);
  const askReady = async () => {
    try {
      const r = await accountsService.readyMailedBills();
      if (!r.length) { toast("No bill is ready any more: open them one by one", "info"); refresh(); return; }
      setReady(r);
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not check the bills", "error"); }
  };
  const enterReady = async () => {
    if (!ready) return;
    setEntering(true);
    const failed: string[] = [];
    let entered = 0;
    for (const r of ready) {
      try { await accountsService.createBill(r.body); entered += 1; } catch (e) {
        failed.push(`${r.summary.supplierName} #${r.summary.billNo}: ${e instanceof ApiError ? e.message : "not entered"}`);
      }
    }
    setEntering(false);
    setReady(null);
    refresh();
    toast(failed.length ? `${entered} entered; ${failed.length} not: ${failed.join("; ")}` : `${entered} bill${entered === 1 ? "" : "s"} entered`, failed.length ? "error" : "success");
  };

  if (!status.data || (!status.data.configured && !status.data.waiting)) return null;
  const list = bills ?? [];
  const readyCount = list.filter((b) => b.ready).length;

  return (
    <Card className="mb-4 p-4" aria-label="Bills by mail">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold"><Mail className="h-4 w-4 text-brand-600" aria-hidden /> Bills by mail <span className="text-sm font-normal text-ink-400">({list.length} to check)</span></h3>
        <span className="flex flex-wrap gap-1">
          {readyCount > 0 && !ready && (
            <Button size="sm" onClick={() => void askReady()}><CheckCheck className="h-4 w-4" aria-hidden /> Enter {readyCount} ready bill{readyCount === 1 ? "" : "s"}</Button>
          )}
          {status.data.configured && (
            <Button size="sm" variant="ghost" loading={read.isPending} onClick={() => read.mutate()}><RefreshCw className="h-4 w-4" aria-hidden /> Check the mailbox</Button>
          )}
        </span>
      </div>
      {ready && (
        <div role="region" aria-label="Ready bills" className="mt-3 rounded-lg border border-status-success/40 bg-status-successBg p-3 text-sm">
          <p className="font-medium">{ready.length === 1 ? "This bill agrees with its supplier, PO receipts and totals. Enter it?" : `These ${ready.length} bills agree with their supplier, PO receipts and totals. Enter them?`}</p>
          <ul className="mt-1 space-y-0.5 text-ink-700">
            {ready.map((r) => (
              <li key={r._id}>{r.summary.supplierName} #{r.summary.billNo} · {formatDate(r.summary.billDate)} · PO #{r.summary.poNo}, {r.summary.receipts} receipt{r.summary.receipts === 1 ? "" : "s"}{r.summary.einvoice ? " · e-invoice" : ""} · <span className="tabular-nums">₹{money(r.summary.grand)}</span></li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-ink-500">Each is entered as a normal bill, with the same checks, and can be cancelled like any other.</p>
          <span className="mt-2 flex gap-2">
            <Button size="sm" loading={entering} onClick={() => void enterReady()}>Enter {ready.length === 1 ? "it" : `these ${ready.length}`}</Button>
            <Button size="sm" variant="secondary" disabled={entering} onClick={() => setReady(null)}>Not now</Button>
          </span>
        </div>
      )}
      <p className="text-xs text-ink-400">
        {status.data.configured ? `Bills mailed to ${status.data.mailbox} are read every ${status.data.everyMin} min, with those sent on WhatsApp.` : "Bills sent on WhatsApp wait here."} Open one to enter it — the form comes filled in, with the bill beside it.
      </p>
      {list.length > 0 && (
        <ul className="mt-3 divide-y divide-ink-100">
          {list.map((b) => (
            <li key={b._id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.supplierName || b.from}{b.billNo && <span className="font-normal text-ink-500"> · #{b.billNo}</span>}</p>
                <p className="truncate text-xs text-ink-400">
                  {b.source === "whatsapp" ? `On WhatsApp from ${b.sentByName || b.from}` : b.from}{b.receivedAt ? ` · ${formatDate(b.receivedAt)}` : ""} · {b.filename}
                </p>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {b.supplier
                    ? <StatusChip tone="success">{b.matchedBy === "gstin" ? "supplier by GSTIN" : "supplier by name — confirm"}</StatusChip>
                    : <StatusChip tone="warning">supplier not on file</StatusChip>}
                  {b.senderKnown && <StatusChip tone="info">{b.source === "whatsapp" ? "from the supplier's phone" : "from the supplier's address"}</StatusChip>}
                  {b.alreadyEntered && <StatusChip tone="danger">already entered as {b.alreadyEntered}</StatusChip>}
                  {b.confidence != null && b.confidence < 0.6 && <StatusChip tone="warning">hard to read</StatusChip>}
                  {b.ready && <StatusChip tone="success">ready: nothing left to check</StatusChip>}
                </span>
                {!b.ready && b.readyWhy && b.readyWhy.length > 0 && (
                  <p className="mt-0.5 text-xs text-ink-500">Needs a look: {b.readyWhy[0]}{b.readyWhy.length > 1 ? ` (and ${b.readyWhy.length - 1} more)` : ""}</p>
                )}
              </div>
              <span className="tabular-nums">{b.grand != null ? `₹${money(b.grand)}` : "—"}</span>
              <span className="flex gap-1">
                <a className="rounded-lg px-2 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100" href={accountsService.mailedBillFileUrl(b._id)} target="_blank" rel="noreferrer">View</a>
                <Link className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:bg-accent-hover" to={`/accounts/bills?mailed=${b._id}`}>Open as a bill</Link>
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
