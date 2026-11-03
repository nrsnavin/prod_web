import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, PlugZap, RotateCcw, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useAuth } from "@/core/auth/useAuth";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { RangePicker, money } from "./shared";
import { ConnectorCard, ReconcileCard } from "./TallyLink";

const lastMonth = () => {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const to = new Date(d.getFullYear(), d.getMonth(), 0);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { from: iso(from), to: iso(to) };
};

async function save(id: string, batchNo: number) {
  const blob = await accountsService.tallyXml(id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tally-batch-${batchNo}.xml`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * A period's documents as Tally vouchers: see what would go and which
 * ledgers Tally must have, send it as a batch (never the same document
 * twice), and close the books behind it.
 */
export function TallyTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();
  const [range, setRange] = useState(lastMonth);
  const [lock, setLock] = useState(true);
  const [masters, setMasters] = useState(false);
  const [busy, setBusy] = useState(false);
  const preview = useQuery({ queryKey: [ACCOUNTS_KEY, "tally-preview", range], queryFn: () => accountsService.tallyPreview(range), enabled: !!range.from && !!range.to });
  const batches = useQuery({ queryKey: [ACCOUNTS_KEY, "tally-batches"], queryFn: accountsService.tallyBatches, refetchInterval: (q) => ((q.state.data ?? []).some((b) => b.delivery?.status === "queued" || b.delivery?.status === "sending") ? 15_000 : false) });
  const connector = useQuery({ queryKey: [ACCOUNTS_KEY, "tally-connector"], queryFn: accountsService.tallyConnector });
  const p = preview.data;

  const send = async (via: "file" | "connector") => {
    setBusy(true);
    try {
      const batch = await accountsService.tallyExport({ ...range, lock: isAdmin && lock, masters, via });
      if (via === "file") {
        await save(batch._id, batch.batchNo);
        toast(`Batch ${batch.batchNo}: ${batch.vouchers} vouchers ready for Tally`, "success");
      } else {
        toast(`Batch ${batch.batchNo}: ${batch.vouchers} vouchers queued — the connector posts them into Tally within a minute`, "success");
      }
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not export", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <RangePicker from={range.from} to={range.to} onChange={setRange} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={masters} onChange={(e) => setMasters(e.target.checked)} /> Create party ledgers Tally does not have</label>
          {isAdmin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} /> Close the books up to {range.to ? formatDate(range.to) : "the end"}</label>}
          <span className="ml-auto flex flex-wrap gap-2">
            {connector.data?.configured && <Button onClick={() => send("connector")} loading={busy} disabled={!p || p.vouchers === 0 || p.problems.length > 0}><PlugZap className="h-4 w-4" /> Post {p?.vouchers ?? 0} into Tally</Button>}
            <Button variant={connector.data?.configured ? "secondary" : "primary"} onClick={() => send("file")} loading={busy} disabled={!p || p.vouchers === 0 || p.problems.length > 0}><Send className="h-4 w-4" /> {connector.data?.configured ? "Or download the file" : `Send ${p?.vouchers ?? 0} to Tally`}</Button>
          </span>
        </div>
        <p className="mt-2 text-xs text-ink-400">Import the file in Tally from Gateway of Tally → Import → Vouchers. Opening balances are not sent: they came from Tally.</p>
      </Card>

      {preview.isLoading ? <Skeleton className="h-48 w-full" /> : p && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <h3 className="font-semibold">What goes</h3>
            {p.vouchers === 0 ? <p className="mt-2 text-sm text-ink-400">Nothing new in this period{p.alreadySent ? ` — ${p.alreadySent} already sent` : ""}.</p> : (
              <ul className="mt-2 space-y-1 text-sm">
                {Object.entries(p.counts).map(([type, count]) => <li key={type} className="flex justify-between"><span>{type}</span><span className="tabular-nums">{count}</span></li>)}
                {p.alreadySent > 0 && <li className="flex justify-between text-ink-400"><span>Already sent</span><span className="tabular-nums">{p.alreadySent}</span></li>}
              </ul>
            )}
            {p.problems.map((x) => <p key={x} className="mt-2 text-sm text-status-danger">{x}</p>)}
            {(p.warnings ?? []).map((x) => <p key={x} className="mt-2 text-sm text-status-warning">{x}</p>)}
          </Card>
          <Card className="p-5 lg:col-span-2">
            <h3 className="font-semibold">Ledgers Tally must have</h3>
            <p className="text-xs text-ink-400">Names must match Tally exactly. Change them under Settings → Tally ledgers, on each bank account and expense head.</p>
            {/* As typed, not upper-cased: the name has to match Tally letter for letter. */}
            <div className="mt-2 flex flex-wrap gap-1.5">{p.ledgers.map((l) => <span key={l} className="rounded-md border border-ink-200 bg-ink-50 px-2 py-0.5 font-mono text-xs text-ink-700">{l}</span>)}</div>
          </Card>
          {p.sample.length > 0 && (
            <Card className="p-5 lg:col-span-3">
              <h3 className="font-semibold">First vouchers</h3>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {p.sample.slice(0, 6).map((v) => (
                  <div key={v.number} className="rounded-lg border border-ink-100 p-3 text-sm">
                    <p className="font-medium">{v.type} · {v.number} <span className="font-normal text-ink-400">· {formatDate(v.date)}</span></p>
                    <table className="mt-1 w-full"><tbody>
                      {v.lines.map((l, i) => <tr key={i}><td className={l.credit ? "pl-4" : ""}>{l.ledger}</td><td className="text-right tabular-nums">{l.debit ? `${money(l.debit)} Dr` : ""}</td><td className="text-right tabular-nums">{l.credit ? `${money(l.credit)} Cr` : ""}</td></tr>)}
                    </tbody></table>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <ConnectorCard isAdmin={isAdmin} />
        <ReconcileCard />
      </div>

      <Card className="p-5">
        <h3 className="font-semibold">Sent before</h3>
        {(batches.data ?? []).length === 0 ? <p className="mt-2 text-sm text-ink-400">No batch yet.</p> : (
          <ul className="mt-2 divide-y divide-ink-100 text-sm">
            {(batches.data ?? []).map((b) => (
              <li key={b._id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="font-medium">Batch {b.batchNo}</span><span className="text-ink-400"> · {formatDate(b.from)} – {formatDate(b.to)} · {b.vouchers} vouchers{b.cancels ? ` · ${b.cancels} cancelled` : ""} · {b.byName} · {formatDate(b.createdAt)}</span>
                  {b.lockedUpTo && <StatusChip tone="info" className="ml-2">books closed</StatusChip>}
                  {b.delivery?.via === "connector" && <StatusChip className="ml-2" tone={b.delivery.status === "sent" ? "success" : b.delivery.status === "partial" || b.delivery.status === "failed" ? "danger" : "info"}>{b.delivery.status === "sent" ? "in Tally" : b.delivery.status === "partial" ? `${b.delivery.failed} refused by Tally` : b.delivery.status === "failed" ? "refused by Tally" : b.delivery.status === "sending" ? "posting…" : "waiting for the connector"}</StatusChip>}
                  {b.delivery?.errors?.length ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-status-danger">{b.delivery.errors.slice(0, 5).map((e) => <li key={e.key}>{e.number}: {e.error}</li>)}</ul>
                  ) : null}
                  {b.delivery?.status === "partial" || b.delivery?.status === "failed" ? <span className="block text-xs text-ink-500">The refused documents are back in the queue: fix the cause in Tally (usually a missing ledger) and send again.</span> : null}
                </span>
                <span className="flex gap-2">
                  {isAdmin && b.delivery?.via === "connector" && (b.delivery.status === "sending" || b.delivery.status === "queued") && <Button size="sm" variant="ghost" onClick={async () => { await accountsService.tallyRequeue(b._id); qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "tally-batches"] }); }}><RotateCcw className="h-4 w-4" /> Queue again</Button>}
                  <Button size="sm" variant="secondary" onClick={() => save(b._id, b.batchNo).catch(() => toast("Could not download", "error"))}><Download className="h-4 w-4" /> XML</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
