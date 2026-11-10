import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, KeyRound, PlugZap, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money } from "./shared";

const ago = (iso?: string | null) => {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : formatDate(iso);
};

/**
 * The connector: the small program on the Tally computer that posts each
 * voucher straight into Tally and reads Tally's ledgers back.
 */
export function ConnectorCard({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: [ACCOUNTS_KEY, "tally-connector"], queryFn: accountsService.tallyConnector, refetchInterval: 60_000 });
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      const r = await accountsService.tallyConnectorKey();
      setKey(r.key);
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "tally-connector"] });
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not create a key", "error"); } finally { setBusy(false); }
  };
  const script = async () => {
    try {
      const blob = await accountsService.tallyConnectorScript();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "tally-connector.js"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { toast("Could not download", "error"); }
  };
  if (isLoading || !data) return <Skeleton className="h-28 w-full" />;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 font-semibold"><PlugZap className="h-4 w-4" /> Straight into Tally</h3>
        {!data.configured ? <StatusChip tone="neutral">not set up</StatusChip>
          : data.online ? <StatusChip tone={data.tallyOk ? "success" : "warning"}>{data.tallyOk ? "connected" : "connector on, Tally not answering"}</StatusChip>
          : <StatusChip tone="warning">connector offline</StatusChip>}
        {data.configured && <span className="text-xs text-ink-400">last heard {ago(data.lastSeenAt)}{data.version ? ` · v${data.version}` : ""}</span>}
      </div>
      <p className="mt-1 text-sm text-ink-500">
        A small program on the computer that runs Tally posts each voucher into it, says which Tally refused and why (those go back in the queue), and reads Tally's ledgers back so the balances can be compared below.
      </p>
      {key && (
        <div role="alert" className="mt-3 rounded-lg border border-status-warning/40 bg-status-warningBg p-3 text-sm">
          <p className="font-semibold">The connector key — copy it now, it is not shown again:</p>
          <code className="mt-1 block break-all rounded bg-surface px-2 py-1 font-mono text-xs">{key}</code>
        </div>
      )}
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-600">
        <li>In Tally: Help (F1) → Settings → Connectivity → TallyPrime acts as <b>Both</b>, port <b>9000</b>. Keep the company open.</li>
        <li>On that computer, install Node.js 18 or newer, and save the connector program in a folder.</li>
        <li>Next to it, a file <code className="font-mono text-xs">tally-connector.json</code>: <code className="font-mono text-xs">{`{ "server": "${window.location.origin}", "key": "…" }`}</code></li>
        <li>Run <code className="font-mono text-xs">node tally-connector.js</code>, and add it to Windows startup.</li>
        <li>In Tally, set each voucher type's numbering to <b>Manual</b> (or Automatic with manual override), so the numbers sent from here are kept — cancellations find vouchers by them.</li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={script}><Download className="h-4 w-4" /> Connector program</Button>
        {isAdmin && <Button size="sm" variant="secondary" loading={busy} onClick={create}><KeyRound className="h-4 w-4" /> {data.configured ? "Replace the key" : "Create a key"}</Button>}
        {isAdmin && data.configured && <Button size="sm" variant="ghost" onClick={async () => { await accountsService.tallyConnectorRevoke(); setKey(null); qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "tally-connector"] }); toast("Key revoked: the connector is cut off", "success"); }}>Revoke</Button>}
      </div>
    </Card>
  );
}

/** Tally's balances against these books, from the connector's last reading. */
export function ReconcileCard() {
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: [ACCOUNTS_KEY, "tally-reconcile"], queryFn: accountsService.tallyReconcile });
  if (isLoading || !data) return <Skeleton className="h-40 w-full" />;
  const differ = data.parties.filter((p) => p.difference !== null && Math.abs(p.difference) >= 0.01);
  const notInTally = data.parties.filter((p) => !p.inTally && Math.abs(p.appSent) >= 0.01);
  const banks = data.banks.filter((b) => b.difference !== null && Math.abs(b.difference) >= 0.01);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Tally against these books</h3>
        <Button size="sm" variant="ghost" loading={isFetching} onClick={() => refetch()}><RefreshCw className="h-4 w-4" /> Compare again</Button>
      </div>
      {!data.snapshot ? (
        <p className="mt-2 text-sm text-ink-400">No reading from Tally yet. Once the connector runs, it reads Tally's ledgers every half hour and the differences show here.</p>
      ) : (
        <div className="mt-2 space-y-4 text-sm">
          <p className="text-ink-500">Tally's ledgers as read {ago(data.snapshot.at)} ({data.snapshot.count} ledgers{data.snapshot.company ? `, ${data.snapshot.company}` : ""}). Compared with what has been <i>sent</i> from here, so documents still waiting are not counted as differences.</p>
          {differ.length === 0 && banks.length === 0 && data.missing.length === 0 && notInTally.length === 0
            ? <StatusChip tone="success">Tally agrees with these books</StatusChip> : null}
          {differ.length > 0 && (
            <div>
              <p className="font-medium">Parties whose balance differs ({differ.length})</p>
              <div className="mt-1 overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead><tr className="text-xs text-ink-500 font-medium"><th className="py-1 text-left font-medium">Party</th><th className="py-1 text-right font-medium">Here (sent)</th><th className="py-1 text-right font-medium">Tally</th><th className="py-1 text-right font-medium">Difference</th></tr></thead>
                  <tbody className="divide-y divide-ink-100">
                    {differ.map((p) => (
                      <tr key={p.party}><td className="py-1.5">{p.tallyName || p.name} <span className="text-xs text-ink-400">{p.partyType}</span></td><td className="py-1.5 text-right tabular-nums">{money(p.appSent)}</td><td className="py-1.5 text-right tabular-nums">{money(p.tally ?? 0)}</td><td className="py-1.5 text-right tabular-nums font-semibold text-status-danger">{money(p.difference ?? 0)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-xs text-ink-400">Usually an entry made in Tally directly, a voucher Tally refused, or a document changed here after it went.</p>
            </div>
          )}
          {banks.length > 0 && (
            <div>
              <p className="font-medium">Bank and cash ({banks.length})</p>
              <ul className="mt-1 divide-y divide-ink-100">{banks.map((b) => <li key={b.account} className="flex flex-wrap justify-between gap-2 py-1.5"><span>{b.tallyName || b.name}{b.unsent ? <span className="text-xs text-ink-400"> · {b.unsent} voucher{b.unsent === 1 ? "" : "s"} not sent yet</span> : null}</span><span className="tabular-nums">here ₹{money(b.app)} · Tally ₹{money(b.tally ?? 0)}</span></li>)}</ul>
            </div>
          )}
          {data.missing.length > 0 && (
            <div>
              <p className="font-medium text-status-warning">Ledgers the next export needs that Tally does not have ({data.missing.length})</p>
              <ul className="mt-1 space-y-0.5">{data.missing.map((m) => <li key={m.ledger}><span className="font-mono text-xs">{m.ledger}</span>{m.near.length ? <span className="text-xs text-ink-500"> — Tally has <span className="font-mono">{m.near.join(", ")}</span>: set "Name in Tally" on the party, or the ledger name in settings</span> : <span className="text-xs text-ink-500"> — tick "Create party ledgers" when sending, or create it in Tally</span>}</li>)}</ul>
            </div>
          )}
          {notInTally.length > 0 && (
            <p className="text-ink-500">{notInTally.length} part{notInTally.length === 1 ? "y has" : "ies have"} sent documents but no ledger of that name in Tally: {notInTally.slice(0, 6).map((p) => p.tallyName || p.name).join(", ")}{notInTally.length > 6 ? "…" : ""}</p>
          )}
          {data.onlyInTally.length > 0 && (
            <details><summary className="cursor-pointer text-ink-500">{data.onlyInTally.length} debtor/creditor ledgers in Tally with a balance and no party here</summary>
              <ul className="mt-1 space-y-0.5">{data.onlyInTally.slice(0, 40).map((l) => <li key={l.name} className="flex justify-between gap-2"><span>{l.name} <span className="text-xs text-ink-400">{l.parent}</span></span><span className="tabular-nums">{money(Math.abs(l.closing))} {l.closing < 0 ? "Dr" : "Cr"}</span></li>)}</ul>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
