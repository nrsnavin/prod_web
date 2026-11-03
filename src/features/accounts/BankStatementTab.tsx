import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Check, EyeOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY, useBankAccounts } from "./hooks";
import { PartyPicker, money, today } from "./shared";
import type { StatementPostRow, StatementResult, StatementRow, StoredStatementLine } from "./types";

type Decision = { use: boolean; partyType: "customer" | "supplier" | "other"; party?: string; partyName?: string; allocations: NonNullable<StatementRow["suggestion"]>["allocations"] };
type View = "match" | "reconcile" | "past";

/** Bank statements: match one to the books, reconcile, or look back at what came before. */
export function BankStatementTab() {
  const { data: accounts } = useBankAccounts();
  // The inbox links straight to a stored statement: ?view=past&account=…&statement=…
  const [params] = useSearchParams();
  const asked = params.get("view");
  const [account, setAccount] = useState(params.get("account") ?? "");
  const [view, setView] = useState<View>(asked === "reconcile" || asked === "past" ? asked : "match");
  const bankAccounts = (accounts ?? []).filter((a) => a.active !== false && a.kind !== "cash");
  const chosen = account || bankAccounts.find((a) => a.isDefault)?._id || bankAccounts[0]?._id || "";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Bank account" value={chosen} onChange={(e) => setAccount(e.target.value)} options={bankAccounts.map((a) => ({ value: a._id, label: a.name }))} placeholder={bankAccounts.length ? undefined : "Add a bank account under Settings first"} />
        <FilterChips options={[{ value: "match", label: "Match a statement" }, { value: "reconcile", label: "Reconcile" }, { value: "past", label: "Past statements" }]} value={view} onChange={setView} />
      </div>
      {chosen && view === "match" && <MatchView account={chosen} />}
      {chosen && view === "reconcile" && <ReconcileView account={chosen} />}
      {chosen && view === "past" && <PastView key={chosen} account={chosen} initial={chosen === params.get("account") ? params.get("statement") : null} />}
    </div>
  );
}

/**
 * A bank statement matched to the books. Each line comes placed —
 * already recorded, settles this invoice or bill, this party, or left
 * for a person — and the ones ticked post as vouchers. A line that is
 * not for the books (a reversed test debit) is set aside with a reason
 * and stays set aside when the statement comes again.
 */
function MatchView({ account }: { account: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StatementResult | null>(null);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [posted, setPosted] = useState<Record<number, string>>({});
  const [ignoring, setIgnoring] = useState<StatementRow | null>(null);

  const upload = async (file?: File) => {
    if (!file || !account) return;
    setBusy(true);
    try {
      const r = await accountsService.uploadStatement(account, file);
      setResult(r);
      setPosted({});
      const d: Record<number, Decision> = {};
      for (const row of r.rows) {
        if (row.status === "matched" && row.suggestion) d[row.index] = { use: row.suggestion.confidence >= 0.65, partyType: row.suggestion.partyType, party: row.suggestion.party, partyName: row.suggestion.partyName, allocations: row.suggestion.allocations };
        else if (row.status === "unmatched") d[row.index] = { use: false, partyType: "other", partyName: "", allocations: [] };
      }
      setDecisions(d);
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "statements"] });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read the statement", "error");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const toPost = useMemo(() => (result?.rows ?? []).filter((r) => r.status !== "recorded" && r.status !== "ignored" && decisions[r.index]?.use && !posted[r.index]), [result, decisions, posted]);

  const post = async () => {
    if (!result || !toPost.length) return;
    setBusy(true);
    try {
      const rows: StatementPostRow[] = toPost.map((r) => {
        const d = decisions[r.index];
        return { index: r.index, date: r.date, narration: r.narration, ref: r.ref, amount: r.amount, direction: r.direction, partyType: d.partyType, party: d.party, partyName: d.partyName || r.narration.slice(0, 60), allocations: d.allocations.map((a) => ({ docType: a.docType, doc: a.doc, amount: a.amount })), requestId: `${result.file}:${r.index}:${r.amount}` };
      });
      const res = await accountsService.postStatement(result.account._id, rows, result.statement);
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

  const ignore = async (reason: string) => {
    if (!ignoring || !result?.statement) return;
    try {
      await accountsService.ignoreLine(result.statement, ignoring.index, reason);
      setResult((r) => r && { ...r, rows: r.rows.map((x) => (x.index === ignoring.index ? { ...x, status: "ignored", note: reason, suggestion: null } : x)) });
      setIgnoring(null);
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "reconciliation"] });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not set it aside", "error");
    }
  };

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <input ref={ref} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" aria-label="Bank statement file" onChange={(e) => upload(e.target.files?.[0])} />
          <Button onClick={() => ref.current?.click()} disabled={!account} loading={busy}><Upload className="h-4 w-4" /> Upload statement (CSV / Excel)</Button>
          <p className="text-xs text-ink-400">Export the statement from the bank's site. Lines already in the books are recognised and marked cleared; the rest are matched to open invoices and bills for you to confirm.</p>
        </div>
      </Card>

      {result && (
        <Card>
          <div className="flex flex-wrap items-center gap-2 px-5 pt-5">
            <h3 className="font-semibold">{result.file}</h3>
            <StatusChip tone="neutral">{result.counts.recorded} already recorded</StatusChip>
            <StatusChip tone="success">{result.counts.matched} matched</StatusChip>
            <StatusChip tone={result.counts.unmatched ? "warning" : "neutral"}>{result.counts.unmatched} to place</StatusChip>
            {!!result.counts.ignored && <StatusChip tone="neutral">{result.counts.ignored} set aside</StatusChip>}
            {result.closingBalance !== null && result.closingBalance !== undefined && <span className="text-sm text-ink-500">Bank balance ₹{money(result.closingBalance)}</span>}
            <Button className="ml-auto" size="sm" onClick={post} disabled={!toPost.length} loading={busy}><Check className="h-4 w-4" /> Post {toPost.length} ticked</Button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-y border-ink-200 text-xs uppercase tracking-wide text-ink-400"><th className="px-5 py-2" /><th className="py-2 text-left font-medium">Date</th><th className="py-2 text-left font-medium">Narration</th><th className="py-2 text-right font-medium">Amount</th><th className="py-2 text-left font-medium">Placed as</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {result.rows.map((r) => {
                  const d = decisions[r.index];
                  const done = r.status === "recorded" || r.status === "ignored" || !!posted[r.index];
                  return (
                    <tr key={r.index} className={done ? "text-ink-400" : ""}>
                      <td className="px-5 py-2">{!done && <input type="checkbox" aria-label={`Post line ${r.index + 1}`} checked={!!d?.use} disabled={d?.partyType === "other" && !d?.partyName && r.direction === "in"} onChange={(e) => setDecisions((x) => ({ ...x, [r.index]: { ...(x[r.index] ?? { partyType: "other", allocations: [] }), use: e.target.checked } }))} />}</td>
                      <td className="py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="py-2 pr-3"><span className="block max-w-md truncate" title={r.narration}>{r.narration}</span>{r.ref && <span className="text-xs text-ink-400">{r.ref}</span>}</td>
                      <td className={`py-2 text-right tabular-nums ${r.direction === "in" ? "text-status-success" : ""}`}>{r.direction === "in" ? "+" : "−"}{money(r.amount)}</td>
                      <td className="py-2 pr-5">
                        {posted[r.index] ? <StatusChip tone={posted[r.index].startsWith("✗") ? "danger" : "success"}>{posted[r.index]}</StatusChip>
                          : r.status === "recorded" ? <span>Already recorded as {r.recorded?.voucherNo}{r.recorded?.partyName ? ` · ${r.recorded.partyName}` : ""}</span>
                          : r.status === "ignored" ? <span>Set aside{r.note ? ` — ${r.note}` : ""}</span>
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
                              {result.statement && <Button size="sm" variant="ghost" onClick={() => setIgnoring(r)}><EyeOff className="h-4 w-4" /> Set aside</Button>}
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
      <ReasonDialog open={!!ignoring} onClose={() => setIgnoring(null)} title="Set this line aside?" description="It stays out of the books, and stays set aside when the statement comes again." confirmLabel="Set aside" minLength={8} onConfirm={ignore} />
    </>
  );
}

/**
 * The bank's balance explained: book balance, less receipts the bank has
 * not shown, plus payments it has not shown, plus or minus statement
 * lines not in the books. What is left is the difference to find.
 */
export function ReconcileView({ account }: { account: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [asOf, setAsOf] = useState(today());
  const [bankBalance, setBankBalance] = useState<number | "">("");
  const [clearOn, setClearOn] = useState(today());
  const { data, isLoading } = useQuery({
    queryKey: [ACCOUNTS_KEY, "reconciliation", account, asOf, bankBalance],
    queryFn: () => accountsService.reconciliation(account, asOf, bankBalance),
  });
  const tick = async (e: { voucherType: "Payment" | "Contra"; _id: string; number: string }) => {
    try {
      await accountsService.clearEntry({ voucherType: e.voucherType, id: e._id, account, clearedOn: clearOn });
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "reconciliation"] });
      toast(`${e.number} cleared on ${formatDate(clearOn)}`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not mark it", "error");
    }
  };
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="As of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          <Input label="Bank's balance" type="number" step="0.01" value={bankBalance} placeholder={data?.bankBalance !== null && data?.bankBalance !== undefined ? String(data.bankBalance) : "from the statement"} onChange={(e) => setBankBalance(e.target.value === "" ? "" : Number(e.target.value))} hint={typeof data?.bankBalanceFrom === "object" && data?.bankBalanceFrom ? `From ${data.bankBalanceFrom.file}` : undefined} />
        </div>
      </Card>
      {isLoading ? <Skeleton className="h-64 w-full" /> : data && (
        <>
          <Card className="p-5">
            <dl className="max-w-lg space-y-1 text-sm" aria-label="Reconciliation">
              <div className="flex justify-between"><dt>Balance in the books</dt><dd className="tabular-nums">₹{money(data.bookBalance)}</dd></div>
              <div className="flex justify-between text-ink-500"><dt>Less receipts the bank has not shown</dt><dd className="tabular-nums">− ₹{money(data.totals.unclearedIn)}</dd></div>
              <div className="flex justify-between text-ink-500"><dt>Add payments the bank has not shown</dt><dd className="tabular-nums">+ ₹{money(data.totals.unclearedOut)}</dd></div>
              <div className="flex justify-between text-ink-500"><dt>Add money in on the statement, not in the books</dt><dd className="tabular-nums">+ ₹{money(data.totals.unmatchedIn)}</dd></div>
              <div className="flex justify-between text-ink-500"><dt>Less money out on the statement, not in the books</dt><dd className="tabular-nums">− ₹{money(data.totals.unmatchedOut)}</dd></div>
              <div className="flex justify-between border-t border-ink-200 pt-1 font-semibold"><dt>The bank should show</dt><dd className="tabular-nums">₹{money(data.expectedBankBalance)}</dd></div>
              <div className="flex justify-between"><dt>The bank shows</dt><dd className="tabular-nums">{data.bankBalance === null ? "—" : `₹${money(data.bankBalance)}`}</dd></div>
              {data.difference !== null && (
                <div className="flex items-center justify-between pt-1"><dt className="font-semibold">Difference</dt><dd>{Math.abs(data.difference) < 0.005 ? <StatusChip tone="success">Reconciled</StatusChip> : <StatusChip tone="danger">₹{money(data.difference)} to find</StatusChip>}</dd></div>
              )}
            </dl>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 className="font-semibold">In the books, not yet in the bank</h3>
                <Input label="Cleared on" type="date" value={clearOn} onChange={(e) => setClearOn(e.target.value)} />
              </div>
              {data.uncleared.length === 0 ? <p className="mt-2 text-sm text-ink-400">Everything has cleared.</p> : (
                <ul className="mt-2 divide-y divide-ink-100 text-sm">
                  {data.uncleared.map((e) => (
                    <li key={`${e.voucherType}-${e._id}-${e.direction}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <span><span className="font-medium">{e.number}</span><span className="text-ink-400"> · {formatDate(e.date)} · {e.party}{e.reference ? ` · ${e.reference}` : ""}</span></span>
                      <span className="flex items-center gap-2"><span className={`tabular-nums ${e.direction === "in" ? "text-status-success" : ""}`}>{e.direction === "in" ? "+" : "−"}₹{money(e.amount)}</span><Button size="sm" variant="secondary" onClick={() => tick(e)}>Cleared</Button></span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold">On the statement, not in the books</h3>
              {data.unmatched.length === 0 ? <p className="mt-2 text-sm text-ink-400">Every statement line is placed.</p> : (
                <ul className="mt-2 divide-y divide-ink-100 text-sm">
                  {data.unmatched.map((l) => (
                    <li key={`${l.statement}-${l.index}`} className="flex justify-between gap-2 py-1.5">
                      <span className="truncate"><span className="text-ink-400">{formatDate(l.date)} · </span>{l.narration}</span>
                      <span className={`tabular-nums ${l.direction === "in" ? "text-status-success" : ""}`}>{l.direction === "in" ? "+" : "−"}₹{money(l.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-ink-400">Post them from "Match a statement" (upload the statement again), or set them aside there.</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

const LINE_TONE: Record<StoredStatementLine["status"], "success" | "info" | "warning" | "neutral"> = { recorded: "success", posted: "info", matched: "warning", unmatched: "warning", ignored: "neutral" };

function PastView({ account, initial = null }: { account: string; initial?: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(initial);
  const [ignoring, setIgnoring] = useState<StoredStatementLine | null>(null);
  const list = useQuery({ queryKey: [ACCOUNTS_KEY, "statements", account], queryFn: () => accountsService.statements(account) });
  const one = useQuery({ queryKey: [ACCOUNTS_KEY, "statement-stored", open], queryFn: () => accountsService.storedStatement(open!), enabled: !!open });
  const toPlace = (one.data?.lines ?? []).filter((l) => l.status === "unmatched" || l.status === "matched").length;
  const ignore = async (reason: string) => {
    if (!ignoring || !open) return;
    try {
      await accountsService.ignoreLine(open, ignoring.index, reason);
      setIgnoring(null);
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
      toast("Set aside", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not set it aside", "error");
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="p-5">
        <h3 className="font-semibold">Uploaded</h3>
        {list.isLoading ? <Skeleton className="mt-2 h-24 w-full" /> : (list.data ?? []).length === 0 ? <p className="mt-2 text-sm text-ink-400">No statement uploaded for this account yet.</p> : (
          <ul className="mt-2 divide-y divide-ink-100 text-sm">
            {(list.data ?? []).map((s) => (
              <li key={s._id}>
                <button className={`w-full py-2 text-left ${open === s._id ? "text-brand-600" : ""}`} onClick={() => setOpen(s._id)}>
                  <span className="font-medium">{s.file || "Statement"}</span>
                  <span className="block text-xs text-ink-400">{formatDate(s.from)} – {formatDate(s.to)} · {s.lines} lines · {s.counts.unmatched ?? 0} unplaced · {formatDate(s.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="p-5 lg:col-span-2">
        {!open ? <p className="text-sm text-ink-400">Pick a statement to see what became of each line.</p> : one.isLoading || !one.data ? <Skeleton className="h-48 w-full" /> : (
          <>
            <h3 className="font-semibold">{one.data.file}</h3>
            {one.data.closingBalance !== null && <p className="text-sm text-ink-500">Bank balance at the end ₹{money(one.data.closingBalance)}</p>}
            {toPlace > 0 && <p className="mt-1 text-sm text-ink-500">{toPlace} line{toPlace === 1 ? "" : "s"} not in the books. Set aside what is not for the books here; to post the rest, upload the statement again under "Match a statement" — lines already placed are remembered.</p>}
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-ink-100">
                  {one.data.lines.map((l) => (
                    <tr key={l.index}>
                      <td className="py-1.5 pr-2 whitespace-nowrap text-ink-500">{formatDate(l.date)}</td>
                      <td className="py-1.5 pr-2"><span className="block max-w-sm truncate" title={l.narration}>{l.narration}</span></td>
                      <td className={`py-1.5 pr-2 text-right tabular-nums ${l.direction === "in" ? "text-status-success" : ""}`}>{l.direction === "in" ? "+" : "−"}{money(l.amount)}</td>
                      <td className="py-1.5"><StatusChip tone={LINE_TONE[l.status]}>{l.voucherNo || (l.status === "matched" ? "suggested, not posted" : l.status === "unmatched" ? "to place" : l.status)}</StatusChip>{l.note && <span className="ml-1 text-xs text-ink-400">{l.note}</span>}</td>
                      <td className="py-1.5 pl-2 text-right">{(l.status === "unmatched" || l.status === "matched") && <Button size="sm" variant="ghost" onClick={() => setIgnoring(l)}><EyeOff className="h-4 w-4" /> Set aside</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
      <ReasonDialog open={!!ignoring} onClose={() => setIgnoring(null)} title="Set this line aside?" description="It stays out of the books, and stays set aside when the statement comes again." confirmLabel="Set aside" minLength={8} onConfirm={ignore} />
    </div>
  );
}
