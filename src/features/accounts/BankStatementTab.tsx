import { useMemo, useRef, useState } from "react";
import { Upload, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY, useBankAccounts } from "./hooks";
import { PartyPicker, money } from "./shared";
import type { StatementPostRow, StatementResult, StatementRow } from "./types";

type Decision = { use: boolean; partyType: "customer" | "supplier" | "other"; party?: string; partyName?: string; allocations: StatementRow["suggestion"] extends infer S ? (S extends { allocations: infer A } ? A : never) : never };

/**
 * A bank statement matched to the books. Each line comes placed —
 * already recorded, settles this invoice or bill, this party, or left
 * for a person — and the ones ticked post as vouchers.
 */
export function BankStatementTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: accounts } = useBankAccounts();
  const ref = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StatementResult | null>(null);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [posted, setPosted] = useState<Record<number, string>>({});
  const bankAccounts = (accounts ?? []).filter((a) => a.active !== false && a.kind !== "cash");
  const chosen = account || bankAccounts.find((a) => a.isDefault)?._id || bankAccounts[0]?._id || "";

  const upload = async (file?: File) => {
    if (!file || !chosen) return;
    setBusy(true);
    try {
      const r = await accountsService.uploadStatement(chosen, file);
      setResult(r);
      setPosted({});
      const d: Record<number, Decision> = {};
      for (const row of r.rows) {
        if (row.status === "matched" && row.suggestion) d[row.index] = { use: row.suggestion.confidence >= 0.65, partyType: row.suggestion.partyType, party: row.suggestion.party, partyName: row.suggestion.partyName, allocations: row.suggestion.allocations };
        else if (row.status === "unmatched") d[row.index] = { use: false, partyType: "other", partyName: "", allocations: [] };
      }
      setDecisions(d);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read the statement", "error");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const toPost = useMemo(() => (result?.rows ?? []).filter((r) => r.status !== "recorded" && decisions[r.index]?.use && !posted[r.index]), [result, decisions, posted]);

  const post = async () => {
    if (!result || !toPost.length) return;
    setBusy(true);
    try {
      const rows: StatementPostRow[] = toPost.map((r) => {
        const d = decisions[r.index];
        return { date: r.date, narration: r.narration, ref: r.ref, amount: r.amount, direction: r.direction, partyType: d.partyType, party: d.party, partyName: d.partyName || r.narration.slice(0, 60), allocations: d.allocations.map((a) => ({ docType: a.docType, doc: a.doc, amount: a.amount })), requestId: `${result.file}:${r.index}:${r.amount}` };
      });
      const res = await accountsService.postStatement(result.account._id, rows);
      const next = { ...posted };
      res.results.forEach((x) => { const row = toPost[x.index]; if (row) next[row.index] = x.ok ? x.voucherNo! : `✗ ${x.error}`; });
      setPosted(next);
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
      toast(`${res.posted} voucher${res.posted === 1 ? "" : "s"} posted${res.failed ? `, ${res.failed} failed` : ""}`, res.failed ? "info" : "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not post", "error");
    } finally {
      setBusy(false);
    }
  };

  const setParty = (row: StatementRow, id: string, name: string) =>
    setDecisions((d) => ({ ...d, [row.index]: { use: true, partyType: row.direction === "in" ? "customer" : "supplier", party: id, partyName: name, allocations: [] } }));

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Bank account" value={chosen} onChange={(e) => setAccount(e.target.value)} options={bankAccounts.map((a) => ({ value: a._id, label: a.name }))} placeholder={bankAccounts.length ? undefined : "Add a bank account under Settings first"} />
          <input ref={ref} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" aria-label="Bank statement file" onChange={(e) => upload(e.target.files?.[0])} />
          <Button onClick={() => ref.current?.click()} disabled={!chosen} loading={busy}><Upload className="h-4 w-4" /> Upload statement (CSV / Excel)</Button>
          <p className="text-xs text-ink-400">Export the statement from the bank's site. Lines already in the books are recognised; the rest are matched to open invoices and bills for you to confirm.</p>
        </div>
      </Card>

      {result && (
        <Card>
          <div className="flex flex-wrap items-center gap-2 px-5 pt-5">
            <h3 className="font-semibold">{result.file}</h3>
            <StatusChip tone="neutral">{result.counts.recorded} already recorded</StatusChip>
            <StatusChip tone="success">{result.counts.matched} matched</StatusChip>
            <StatusChip tone={result.counts.unmatched ? "warning" : "neutral"}>{result.counts.unmatched} to place</StatusChip>
            <Button className="ml-auto" size="sm" onClick={post} disabled={!toPost.length} loading={busy}><Check className="h-4 w-4" /> Post {toPost.length} ticked</Button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-y border-ink-200 text-xs uppercase tracking-wide text-ink-400"><th className="px-5 py-2" /><th className="py-2 text-left font-medium">Date</th><th className="py-2 text-left font-medium">Narration</th><th className="py-2 text-right font-medium">Amount</th><th className="py-2 text-left font-medium">Placed as</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {result.rows.map((r) => {
                  const d = decisions[r.index];
                  return (
                    <tr key={r.index} className={r.status === "recorded" || posted[r.index] ? "text-ink-400" : ""}>
                      <td className="px-5 py-2">{r.status !== "recorded" && !posted[r.index] && <input type="checkbox" aria-label={`Post line ${r.index + 1}`} checked={!!d?.use} disabled={d?.partyType === "other" && !d?.partyName && r.direction === "in"} onChange={(e) => setDecisions((x) => ({ ...x, [r.index]: { ...(x[r.index] ?? { partyType: "other", allocations: [] }), use: e.target.checked } }))} />}</td>
                      <td className="py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="py-2 pr-3"><span className="block max-w-md truncate" title={r.narration}>{r.narration}</span>{r.ref && <span className="text-xs text-ink-400">{r.ref}</span>}</td>
                      <td className={`py-2 text-right tabular-nums ${r.direction === "in" ? "text-status-success" : ""}`}>{r.direction === "in" ? "+" : "−"}{money(r.amount)}</td>
                      <td className="py-2 pr-5">
                        {posted[r.index] ? <StatusChip tone={posted[r.index].startsWith("✗") ? "danger" : "success"}>{posted[r.index]}</StatusChip>
                          : r.status === "recorded" ? <span>Already recorded as {r.recorded?.voucherNo}{r.recorded?.partyName ? ` · ${r.recorded.partyName}` : ""}</span>
                          : r.status === "matched" && r.suggestion ? (
                            <span>
                              <span className="font-medium">{d?.partyName || r.suggestion.partyName}</span>
                              {d?.allocations.length ? <span className="text-ink-500"> → {d.allocations.map((a) => `${a.docNo} ₹${money(a.amount)}`).join(", ")}</span> : <span className="text-ink-500"> · on account</span>}
                              <StatusChip tone={r.suggestion.confidence >= 0.85 ? "success" : "warning"} className="ml-2">{Math.round(r.suggestion.confidence * 100)}%</StatusChip>
                              <span className="block text-xs text-ink-400">{r.suggestion.reason}</span>
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="w-56"><PartyPicker partyType={r.direction === "in" ? "customer" : "supplier"} label="" value={d?.party ?? ""} onChange={(id, name) => setParty(r, id, name)} /></div>
                              {r.candidates?.length ? <span className="text-xs text-ink-400">maybe {r.candidates.map((c) => `${c.partyName} (${c.docNo})`).join(", ")}</span> : <span className="text-xs text-ink-400">nothing open for this amount</span>}
                              {r.direction === "out" && <Button size="sm" variant="ghost" onClick={() => setDecisions((x) => ({ ...x, [r.index]: { use: true, partyType: "other", partyName: r.narration.slice(0, 60), allocations: [] } }))}>Not a supplier</Button>}
                            </div>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
