import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Check, EyeOff, Mail, RefreshCw, Server, AlertTriangle, BookmarkCheck, Trash2, Sparkles, ArrowLeftRight, Unlink } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { InlineConfirm } from "@/components/ui/InlineConfirm";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/core/format/date";
import { useAuth } from "@/core/auth/useAuth";
import { accountsService } from "./api";
import { ACCOUNTS_KEY, useBankAccounts, useCategories } from "./hooks";
import { PartyPicker, money, today } from "./shared";
import type { BankAlias, BankFeedMail, BankFeedRun, StatementContinuity, StatementPostResult, StatementPostRow, StatementResult, StatementRow, StoredStatementFull, StoredStatementLine } from "./types";

type Decision = {
  use: boolean; partyType: "customer" | "supplier" | "other"; party?: string; partyName?: string; allocations: NonNullable<StatementRow["suggestion"]>["allocations"];
  /** Remember this payer (keep) by narration text the next statement's lines are matched on. */
  keep?: boolean;
  remember?: string;
  /** The person said it is not a customer / supplier on file, and named who it is. */
  notOnFile?: boolean;
  /** Money between this account and another of ours: posted as a contra. */
  contra?: { account: string; accountName: string };
  /** Someone not on file: the expense head (money out), or interest (money in). */
  head?: string;
  headName?: string;
  incomeLedger?: "interest";
};

// Words every narration carries, which say nothing about who paid.
const NOISE = /^(NEFT|RTGS|IMPS|UPI|INB|MB|MOB|TRANSFER|TRF|PAYMENT|PAYMEN|PAY|CR|DR|BY|TO|FROM|REF|CHQ|CHEQUE|CLG|DEP|DEPOSIT|ACH|NACH|ECS|BIL|ONL|ONLINE|NETBANKING|NET BANKING)$/;

/**
 * What to remember a payer by, guessed from the narration: a UPI id when
 * there is one, else the longest stretch of words between the bank's
 * separators that is not a code, a number or a bank's own word. The
 * person can change it before posting.
 */
export function guessAlias(narration: string): string {
  const text = String(narration || "").toUpperCase().replace(/\s+/g, " ").trim();
  const vpa = text.match(/[A-Z0-9._-]{2,}@[A-Z0-9.-]{2,}/);
  if (vpa) return vpa[0];
  const parts = text.split(/[-/:|*]+/).map((p) => p.trim())
    .filter((p) => p.length >= 4 && /[A-Z]{3}/.test(p) && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(p) && !NOISE.test(p) && (p.match(/\d/g) ?? []).length <= p.length / 3);
  const best = parts.sort((a, b) => b.length - a.length)[0] ?? "";
  return best.slice(0, 60);
}

/** How this upload sits against the last one, in a sentence or two. */
function ContinuityNote({ c }: { c: StatementContinuity }) {
  const notes: Array<{ tone: "warning" | "neutral"; text: string }> = [];
  if (c.balanceDiff !== null && Math.abs(c.balanceDiff) > 0.005) {
    notes.push({ tone: "warning", text: `The balance does not carry over: this statement opens at ₹${money(c.openingBalance)}, the last one closed at ₹${money(c.previous?.closingBalance)} — ₹${money(Math.abs(c.balanceDiff))} ${c.balanceDiff > 0 ? "came in" : "went out"} on days not in either. Download ${c.previous ? `from ${formatDate(nextDay(c.previous.to))} ` : ""}again and upload it.` });
  } else if (c.gapDays > 0) {
    notes.push({ tone: c.balanceDiff === 0 ? "neutral" : "warning", text: `${c.gapDays} day${c.gapDays === 1 ? "" : "s"} between the last statement (to ${formatDate(c.previous?.to)}) and this one ${c.balanceDiff === 0 ? "— the balance carries over, so nothing moved on them." : "are in neither. Download them too, or check nothing moved on those days."}` });
  }
  if (c.overlapLines > 0) notes.push({ tone: "neutral", text: `${c.overlapLines} line${c.overlapLines === 1 ? " was" : "s were"} in an earlier statement too: what was posted then shows as already recorded.` });
  if (!notes.length) return c.previous ? <p className="px-5 pt-2 text-sm text-status-success">Follows on from the last statement (to {formatDate(c.previous.to)}) with nothing missing.</p> : null;
  return (
    <div className="space-y-1 px-5 pt-2" aria-label="How this statement follows the last">
      {notes.map((n) => <p key={n.text} className={`flex items-start gap-1.5 text-sm ${n.tone === "warning" ? "text-status-warning" : "text-ink-500"}`}>{n.tone === "warning" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}{n.text}</p>)}
    </div>
  );
}

const nextDay = (d: string | Date) => new Date(new Date(d).getTime() + 86_400_000);

/** What to download next: from the day after the last statement for this account. */
function NextDownload({ account }: { account: string }) {
  const { data } = useQuery({ queryKey: [ACCOUNTS_KEY, "statements", account], queryFn: () => accountsService.statements(account) });
  if (!data) return null;
  const last = [...data].sort((a, b) => new Date(b.to).getTime() - new Date(a.to).getTime())[0];
  return (
    <p className="w-full text-sm text-ink-600" aria-label="Next download">
      {last
        ? <>Last statement for this account runs to <span className="font-medium">{formatDate(last.to)}</span>{last.closingBalance !== null ? ` (balance ₹${money(last.closingBalance)})` : ""}. Download from <span className="font-medium">{formatDate(nextDay(last.to))}</span> to today — a day or two of overlap is fine.</>
        : "No statement for this account yet. Download from the day the books start here, or the last few weeks, to today."}
    </p>
  );
}

/** Payers and payees the matcher remembers, and a way to forget a wrong one. */
function RememberedPayers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: [ACCOUNTS_KEY, "bank-aliases"], queryFn: () => accountsService.bankAliases() });
  if (!data?.length) return null;
  const forget = async (a: BankAlias) => {
    try { await accountsService.forgetBankAlias(a._id); qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "bank-aliases"] }); toast(`Forgot "${a.text}"`, "success"); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not forget it", "error"); }
  };
  return (
    <Card className="p-5">
      <details>
        <summary className="flex cursor-pointer items-center gap-2 font-semibold"><BookmarkCheck className="h-4 w-4" /> Remembered payers ({data.length})</summary>
        <p className="mt-2 text-sm text-ink-500">A statement line carrying this text is matched to the party, for you to confirm. Forget one that was remembered wrongly.</p>
        <ul className="mt-2 divide-y divide-ink-100 text-sm" aria-label="Remembered payers">
          {data.map((a) => (
            <li key={a._id} className="flex flex-wrap items-center gap-2 py-1.5">
              <span className="font-mono text-xs">{a.text}</span>
              <span className="text-ink-400">{a.direction === "in" ? "money in from" : "money out to"}</span>
              <span className="font-medium">{a.partyName}</span>
              {a.headName ? <StatusChip tone="neutral">{a.headName}</StatusChip> : a.incomeLedger === "interest" ? <StatusChip tone="neutral">interest</StatusChip> : a.partyType === "other" && <StatusChip tone="neutral">not on file</StatusChip>}
              <span className="ml-auto text-xs text-ink-400">{a.lastMatchedAt ? `last matched ${formatDate(a.lastMatchedAt)}` : "not matched yet"}</span>
              <Button size="sm" variant="ghost" aria-label={`Forget ${a.text}`} onClick={() => forget(a)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
type View = "match" | "reconcile" | "past";

/** Bank statements: match one to the books, reconcile, or look back at what came before. */
export function BankStatementTab() {
  const { data: accounts } = useBankAccounts();
  // The inbox links straight to a stored statement: ?view=past&account=…&statement=…
  const [params] = useSearchParams();
  const asked = params.get("view");
  const [account, setAccount] = useState(params.get("account") ?? "");
  const [view, setView] = useState<View>(asked === "reconcile" || asked === "past" ? asked : "match");
  // A stored statement (one that came by email, or an earlier upload) opened for matching.
  const [matching, setMatching] = useState<string | null>(null);
  const bankAccounts = (accounts ?? []).filter((a) => a.active !== false && a.kind !== "cash");
  const chosen = account || bankAccounts.find((a) => a.isDefault)?._id || bankAccounts[0]?._id || "";
  const openForMatching = (acct: string, statement: string) => { if (acct) setAccount(acct); setMatching(statement); setView("match"); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Bank account" value={chosen} onChange={(e) => { setAccount(e.target.value); setMatching(null); }} options={bankAccounts.map((a) => ({ value: a._id, label: a.name }))} placeholder={bankAccounts.length ? undefined : "Add a bank account under Settings first"} />
        <FilterChips options={[{ value: "match", label: "Match a statement" }, { value: "reconcile", label: "Reconcile" }, { value: "past", label: "Past statements" }]} value={view} onChange={(v) => { setView(v); if (v !== "match") setMatching(null); }} />
      </div>
      <BankFeedCard onOpen={openForMatching} />
      {chosen && view === "match" && <MatchView key={`${chosen}:${matching ?? "upload"}`} account={chosen} statement={matching} onClose={() => setMatching(null)} />}
      {view === "match" && <RememberedPayers />}
      {chosen && view === "reconcile" && <ReconcileView account={chosen} />}
      {chosen && view === "past" && <PastView key={chosen} account={chosen} initial={chosen === params.get("account") ? params.get("statement") : null} onMatch={(id) => openForMatching(chosen, id)} />}
    </div>
  );
}

const MAIL_TONE: Record<BankFeedMail["status"], "success" | "neutral" | "warning" | "danger"> = { imported: "success", nothing_new: "neutral", skipped: "warning", failed: "danger" };
const MAIL_LABEL: Record<BankFeedMail["status"], string> = { imported: "read", nothing_new: "nothing new", skipped: "not read", failed: "failed" };
const when = (v: string | null | undefined) => (v ? new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

function runSummary(r: BankFeedRun | null): string {
  if (!r) return "Not checked yet";
  if (r.error) return `Last check failed: ${r.error}`;
  if (!r.checked) return "No new mail";
  const bits = [`${r.imported} statement${r.imported === 1 ? "" : "s"} read`, `${r.newLines} new line${r.newLines === 1 ? "" : "s"}`];
  if (r.posted) bits.push(`${r.posted} posted`);
  if (r.skipped) bits.push(`${r.skipped} not read`);
  if (r.failed) bits.push(`${r.failed} failed`);
  return bits.join(" · ");
}

/**
 * Statements the bank sends on a schedule — mailed to a mailbox, or put
 * on its SFTP server as MT940 — read by the server: when it last looked,
 * what each mail or file became, and a way in to match the lines. Until
 * one is set up it says how.
 */
export function BankFeedCard({ onOpen }: { onOpen: (account: string, statement: string) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  const { data } = useQuery({ queryKey: [ACCOUNTS_KEY, "bank-feed"], queryFn: () => accountsService.bankFeed() });
  if (!data) return null;

  if (!data.configured) {
    return (
      <Card className="p-5">
        <details>
          <summary className="flex cursor-pointer items-center gap-2 font-semibold"><Mail className="h-4 w-4" /> Get statements from the bank instead of uploading them</summary>
          <p className="mt-3 text-sm font-medium">By email</p>
          <ol className="mt-3 max-w-2xl list-decimal space-y-1.5 pl-5 text-sm text-ink-600">
            <li>Make a mailbox only for statements, e.g. statements@yourcompany.com, and turn on IMAP for it (Gmail and Google Workspace need an app password).</li>
            <li>In the bank's corporate net banking, schedule the account statement daily (or hourly, where the bank offers it) as <strong>CSV or Excel</strong>, mailed to that mailbox. A PDF statement cannot be read.</li>
            <li>Ask whoever runs the server to set BANK_FEED_IMAP_HOST, BANK_FEED_IMAP_USER, BANK_FEED_IMAP_PASS and BANK_FEED_SENDERS (the bank's sending address or @domain).</li>
            <li>Make sure each bank account here has its account number, or fill in "Statements come from" under Settings → Accounts.</li>
          </ol>
          <p className="mt-3 text-sm font-medium">Or by SFTP (MT940)</p>
          <p className="mt-1 max-w-2xl text-sm text-ink-600">If the bank's cash-management desk puts the day's statement on an SFTP server, ask whoever runs the server to set BANK_SFTP_HOST, BANK_SFTP_USER, BANK_SFTP_PASS (or a key) and BANK_SFTP_DIR. The first check reports the server's key; once it is confirmed with the bank and set as BANK_SFTP_HOST_KEY, files are read. MT940 names its account, so each line lands in the right one.</p>
          <p className="mt-2 text-xs text-ink-400">New lines then appear here on their own. Lines already in the books are marked cleared; the rest wait for you to confirm, just as with an upload.</p>
        </details>
      </Card>
    );
  }

  const check = async () => {
    setBusy(true);
    try {
      const res = await accountsService.runBankFeed();
      qc.setQueryData([ACCOUNTS_KEY, "bank-feed"], res.feed);
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
      toast(runSummary(res.result), res.result.error || res.result.failed ? "info" : "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not check the mailbox", "error");
    } finally {
      setBusy(false);
    }
  };
  const setAuto = async (autoPost: boolean) => {
    try {
      qc.setQueryData([ACCOUNTS_KEY, "bank-feed"], await accountsService.setBankFeed({ autoPost }));
      toast(autoPost ? "Sure matches from the bank's signed mail will post on their own" : "Every line now waits for a person", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    }
  };
  const mails = all ? data.recent : data.recent.slice(0, 4);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-semibold"><Mail className="h-4 w-4" /> Statements from the bank</h3>
          <p className="text-sm text-ink-500">{[data.mailbox, data.sftp && `sftp://${data.sftp.host}${data.sftp.dir === "/" ? "" : data.sftp.dir}`].filter(Boolean).join(" and ")} · {data.everyMin ? `checked every ${data.everyMin} min` : "checked when asked"} · last {when(data.lastRunAt)}</p>
          {data.sftp && !data.sftp.hostKeySet && <p className="text-sm text-status-warning">The SFTP server's key is not set yet, so no file is read. The last check shows the key it offered: confirm it with the bank, then set BANK_SFTP_HOST_KEY.</p>}
          <p className={`text-sm ${data.lastResult?.error ? "text-status-danger" : "text-ink-500"}`}>{runSummary(data.lastResult)}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={check} loading={busy}><RefreshCw className="h-4 w-4" /> Check the mailbox now</Button>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" checked={data.autoPost} disabled={!isAdmin} onChange={(e) => setAuto(e.target.checked)} />
        <span>Post lines it is sure of without a person<span className="block text-xs text-ink-400">Only a line naming the invoice or bill with the amount exact, and only from the bank's own signed mail{data.senders.length ? ` (${data.senders.join(", ")})` : ""} or its SFTP server.{!isAdmin ? " An admin can change this." : ""}</span></span>
      </label>
      {data.recent.length > 0 && (
        <ul className="mt-3 divide-y divide-ink-100 text-sm" aria-label="Statements received">
          {mails.map((m) => (
            <li key={m._id} className="flex flex-wrap items-center gap-2 py-2">
              {m.channel === "sftp" ? <Server className="h-4 w-4 shrink-0 text-ink-400" aria-label="SFTP file" /> : <Mail className="h-4 w-4 shrink-0 text-ink-400" aria-label="Mail" />}
              <StatusChip tone={MAIL_TONE[m.status]}>{MAIL_LABEL[m.status]}</StatusChip>
              <span className="min-w-0 flex-1">
                <span className="block truncate" title={m.subject}>{m.subject || "(no subject)"}</span>
                <span className="block text-xs text-ink-400">{when(m.receivedAt)}{m.accountName ? ` · ${m.accountName}` : ""}{m.status === "imported" ? ` · ${m.newLines ?? 0} new line${m.newLines === 1 ? "" : "s"}${m.posted ? `, ${m.posted} posted` : ""}` : ""}{m.note ? ` · ${m.note}` : ""}</span>
              </span>
              {m.status === "imported" && m.statement && m.account && <Button size="sm" variant="ghost" onClick={() => onOpen(m.account!, m.statement!)}>Match lines</Button>}
            </li>
          ))}
        </ul>
      )}
      {data.recent.length > 4 && <button className="mt-1 text-xs text-brand-600" onClick={() => setAll((x) => !x)}>{all ? "Show fewer" : `Show all ${data.recent.length}`}</button>}
    </Card>
  );
}

/** A stored statement, as the match screen shows a fresh upload. */
export function storedToResult(s: StoredStatementFull): StatementResult {
  const counts = { recorded: 0, matched: 0, unmatched: 0, ignored: 0 };
  const rows: StatementRow[] = s.lines.map((l) => {
    const inBooks = l.status === "recorded" || l.status === "posted";
    // A statement stored before suggestions were kept has none: a person places it.
    const status: StatementRow["status"] = inBooks ? "recorded" : l.status === "matched" && !l.suggestion ? "unmatched" : (l.status as StatementRow["status"]);
    counts[status] += 1;
    return {
      index: l.index, date: l.date, narration: l.narration, ref: l.ref, amount: l.amount, direction: l.direction, balance: l.balance, note: l.note,
      status,
      suggestion: status === "matched" ? l.suggestion ?? null : null,
      recorded: inBooks ? { _id: l.voucher ?? "", voucherType: l.voucherType ?? undefined, voucherNo: l.voucherNo, partyName: "" } : undefined,
      candidates: l.candidates ?? undefined,
    };
  });
  return { statement: s._id, account: { _id: s.account, name: s.accountName }, rows, counts, file: s.file || "Statement", closingBalance: s.closingBalance };
}

/**
 * A bank statement matched to the books. Each line comes placed —
 * already recorded, settles this invoice or bill, this party, or left
 * for a person — and the ones ticked post as vouchers. A line that is
 * not for the books (a reversed test debit) is set aside with a reason
 * and stays set aside when the statement comes again.
 */
function MatchView({ account, statement = null, onClose }: { account: string; statement?: string | null; onClose?: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StatementResult | null>(null);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [posted, setPosted] = useState<Record<number, string>>({});
  const [ignoring, setIgnoring] = useState<StatementRow | null>(null);
  const [filter, setFilter] = useState<"all" | "look">("all");
  const { data: categories } = useCategories();
  const { data: allAccounts } = useBankAccounts();
  const ownAccounts = (allAccounts ?? []).filter((a) => a.active !== false && a._id !== account);

  const show = (r: StatementResult) => {
    setResult(r);
    setPosted({});
    const d: Record<number, Decision> = {};
    for (const row of r.rows) {
      if (row.status === "matched" && row.suggestion) {
        const sg = row.suggestion;
        d[row.index] = {
          use: sg.confidence >= 0.65, partyType: sg.partyType, party: sg.party ?? undefined, partyName: sg.partyName, allocations: sg.allocations,
          ...(sg.kind === "contra" && sg.account ? { contra: { account: sg.account, accountName: sg.accountName ?? sg.partyName } } : {}),
          ...(sg.head ? { head: sg.head, headName: sg.headName } : {}), ...(sg.incomeLedger ? { incomeLedger: sg.incomeLedger } : {}),
        };
      }
      else if (row.status === "unmatched") d[row.index] = { use: false, partyType: "other", partyName: "", allocations: [] };
    }
    setDecisions(d);
  };

  // Open a stored statement (one that came by email) with what the matcher proposed then.
  useEffect(() => {
    if (!statement) return;
    let live = true;
    setBusy(true);
    accountsService.storedStatement(statement)
      .then((s) => { if (live) show(storedToResult(s)); })
      .catch((e) => { if (live) toast(e instanceof Error ? e.message : "Could not open the statement", "error"); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statement]);

  const upload = async (file?: File) => {
    if (!file || !account) return;
    setBusy(true);
    try {
      const r = await accountsService.uploadStatement(account, file);
      show(r);
      onClose?.();
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
        return { index: r.index, date: r.date, narration: r.narration, ref: r.ref, amount: r.amount, direction: r.direction, partyType: d.partyType, party: d.party, partyName: d.partyName || r.narration.slice(0, 60), allocations: d.allocations.map((a) => ({ docType: a.docType, doc: a.doc, amount: a.amount })), requestId: `${result.statement ?? result.file}:${r.index}:${r.amount}`, ...(d.keep && d.remember?.trim() && !d.contra ? { remember: { text: d.remember.trim() } } : {}),
          ...(d.contra ? { contra: { account: d.contra.account } } : {}), ...(d.partyType === "other" && d.head && r.direction === "out" ? { head: d.head } : {}), ...(d.partyType === "other" && d.incomeLedger && r.direction === "in" ? { incomeLedger: d.incomeLedger } : {}) };
      });
      const res = await accountsService.postStatement(result.account._id, rows, result.statement);
      const next = { ...posted };
      // A line someone else placed meanwhile (or this very request, sent twice) is
      // answered with the voucher it already has: said as such, not as a new posting.
      res.results.forEach((x) => { const row = toPost[x.index]; if (row) next[row.index] = !x.ok ? `✗ ${x.error}` : wasThere(x) ? `${ALREADY}${x.voucherNo ? ` as ${x.voucherNo}` : ""}` : x.voucherNo || "posted"; });
      setPosted(next);
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
      const remembered = res.results.filter((x) => x.remembered).length;
      const already = res.results.filter((x) => x.ok && wasThere(x)).length;
      const fresh = res.posted - already;
      toast(`${fresh} voucher${fresh === 1 ? "" : "s"} posted${already ? ` · ${already} line${already === 1 ? " was" : "s were"} already in the books, nothing posted again` : ""}${res.failed ? `, ${res.failed} failed` : ""}${remembered ? ` · ${remembered} payer${remembered === 1 ? "" : "s"} remembered for next time` : ""}`, res.failed || already ? "info" : "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not post", "error");
    } finally {
      setBusy(false);
    }
  };

  // Match the lines still to place again: after adding a party or an invoice, or to have the AI look.
  const rematch = async () => {
    if (!result?.statement) return;
    setBusy(true);
    try {
      const r = await accountsService.rematchStatement(result.statement);
      show(storedToResult(r.statement));
      toast(r.changed ? `${r.changed} line${r.changed === 1 ? "" : "s"} placed differently` : "Nothing new to suggest", r.changed ? "success" : "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not match again", "error");
    } finally {
      setBusy(false);
    }
  };
  const setTransfer = (row: StatementRow, accountId: string) => {
    const a = ownAccounts.find((x) => x._id === accountId);
    setDecisions((x) => ({ ...x, [row.index]: a ? { use: true, partyType: "other", notOnFile: true, partyName: a.name, allocations: [], contra: { account: a._id, accountName: a.name }, keep: false } : { ...x[row.index], contra: undefined } }));
  };
  // A line to look at: still to place, or placed by the AI or with less than a sure match.
  const needsLook = (r: StatementRow) => r.status === "unmatched" || (r.status === "matched" && (!!r.suggestion?.byModel || (r.suggestion?.confidence ?? 0) < 0.85));
  const byAi = (result?.rows ?? []).filter((r) => r.status === "matched" && r.suggestion?.byModel).length;

  // A party chosen by hand: offer to remember it, from what the narration says.
  const remembering = (prev: Decision | undefined, row: StatementRow) => {
    const text = prev?.remember ?? guessAlias(row.narration);
    return { remember: text, keep: prev?.keep ?? !!text };
  };
  const setParty = (row: StatementRow, id: string, name: string) =>
    setDecisions((d) => ({ ...d, [row.index]: { use: true, partyType: row.direction === "in" ? "customer" : "supplier", party: id, partyName: name, allocations: [], ...remembering(d[row.index], row) } }));
  const setOther = (row: StatementRow) =>
    setDecisions((x) => ({ ...x, [row.index]: { use: true, partyType: "other", notOnFile: true, partyName: guessAlias(row.narration) || row.narration.slice(0, 60), allocations: [], ...remembering(x[row.index], row) } }));
  const patch = (row: StatementRow, p: Partial<Decision>) => setDecisions((x) => ({ ...x, [row.index]: { ...x[row.index], ...p } }));

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
          <input ref={ref} type="file" accept=".csv,.xlsx,.xls,.htm,.html,.sta,.mt940,.940,.txt,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" aria-label="Bank statement file" onChange={(e) => upload(e.target.files?.[0])} />
          {!statement && <NextDownload account={account} />}
          <Button onClick={() => ref.current?.click()} disabled={!account} loading={busy}><Upload className="h-4 w-4" /> Upload statement (CSV / Excel / MT940)</Button>
          <p className="text-xs text-ink-400">Download the statement from net banking as CSV or Excel. Lines already in the books are recognised and marked cleared; the rest are matched to open invoices and bills for you to confirm.</p>
          {statement && result && <StatusChip tone="info">Opened from the stored statement</StatusChip>}
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
            {byAi > 0 && <StatusChip tone="info"><span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" aria-hidden /> {byAi} placed by AI — check them</span></StatusChip>}
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <FilterChips options={[{ value: "all", label: "All lines" }, { value: "look", label: `Needs a look (${result.rows.filter((r) => !posted[r.index] && needsLook(r)).length})` }]} value={filter} onChange={setFilter} />
              {result.statement && <Button size="sm" variant="secondary" onClick={rematch} loading={busy}><Sparkles className="h-4 w-4" /> Match again</Button>}
              <Button size="sm" onClick={post} disabled={!toPost.length} loading={busy}><Check className="h-4 w-4" /> Post {toPost.length} ticked</Button>
            </span>
          </div>
          {result.continuity && <ContinuityNote c={result.continuity} />}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-y border-ink-200 text-xs text-ink-500 font-medium"><th className="px-5 py-2" /><th className="py-2 text-left font-medium">Date</th><th className="py-2 text-left font-medium">Narration</th><th className="py-2 text-right font-medium">Amount</th><th className="py-2 text-left font-medium">Placed as</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {result.rows.filter((r) => filter === "all" || (!posted[r.index] && needsLook(r))).map((r) => {
                  const d = decisions[r.index];
                  const done = r.status === "recorded" || r.status === "ignored" || !!posted[r.index];
                  return (
                    <tr key={r.index} className={done ? "text-ink-400" : ""}>
                      <td className="px-5 py-2">{!done && <input type="checkbox" aria-label={`Post line ${r.index + 1}`} checked={!!d?.use} disabled={d?.partyType === "other" && !d?.partyName && r.direction === "in"} onChange={(e) => setDecisions((x) => ({ ...x, [r.index]: { ...(x[r.index] ?? { partyType: "other", allocations: [] }), use: e.target.checked } }))} />}</td>
                      <td className="py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="py-2 pr-3"><span className="block max-w-md truncate" title={r.narration}>{r.narration}</span>{r.ref && <span className="text-xs text-ink-400">{r.ref}</span>}</td>
                      <td className={`py-2 text-right tabular-nums ${r.direction === "in" ? "text-status-success" : ""}`}>{r.direction === "in" ? "+" : "−"}{money(r.amount)}</td>
                      <td className="py-2 pr-5">
                        {posted[r.index] ? <StatusChip tone={posted[r.index].startsWith("✗") ? "danger" : posted[r.index].startsWith(ALREADY) ? "info" : "success"}>{posted[r.index]}</StatusChip>
                          : r.status === "recorded" ? <span>Already recorded as {r.recorded?.voucherNo}{r.recorded?.partyName ? ` · ${r.recorded.partyName}` : ""}</span>
                          : r.status === "ignored" ? <span>Set aside{r.note ? ` — ${r.note}` : ""}</span>
                          : r.status === "matched" && r.suggestion ? (
                            <span>
                              {r.suggestion.kind === "contra"
                                ? <span className="inline-flex items-center gap-1 font-medium"><ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Transfer {r.direction === "out" ? "to" : "from"} {r.suggestion.accountName}</span>
                                : <span className="font-medium">{d?.partyName || r.suggestion.partyName}</span>}
                              {r.suggestion.kind === "contra" ? null
                                : d?.allocations.length ? <span className="text-ink-500"> → {d.allocations.map((a) => `${a.docNo} ₹${money(a.amount)}`).join(", ")}</span>
                                : r.suggestion.headName ? <span className="text-ink-500"> · under {r.suggestion.headName}</span>
                                : r.suggestion.incomeLedger === "interest" ? <span className="text-ink-500"> · interest received</span>
                                : <span className="text-ink-500">{r.suggestion.partyType === "other" ? " · not a party on file" : " · on account"}</span>}
                              <StatusChip tone={r.suggestion.confidence >= 0.85 ? "success" : "warning"} className="ml-2">{Math.round(r.suggestion.confidence * 100)}%</StatusChip>
                              {r.suggestion.byModel && <StatusChip tone="info" className="ml-1"><span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" aria-hidden /> AI</span></StatusChip>}
                              {r.suggestion.remembered && <StatusChip tone="info" className="ml-1">remembered</StatusChip>}
                              <span className="block text-xs text-ink-400">{r.suggestion.reason}</span>
                            </span>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                {d?.contra ? (
                                  <div className="w-56"><Select aria-label={`Other account, line ${r.index + 1}`} value={d.contra.account} onChange={(e) => setTransfer(r, e.target.value)} options={ownAccounts.map((a) => ({ value: a._id, label: `${r.direction === "out" ? "To" : "From"} ${a.name}` }))} /></div>
                                ) : d?.notOnFile ? (
                                  <>
                                    <div className="w-56"><Input aria-label={r.direction === "in" ? `Received from, line ${r.index + 1}` : `Paid to, line ${r.index + 1}`} value={d.partyName ?? ""} onChange={(e) => patch(r, { partyName: e.target.value })} placeholder={r.direction === "in" ? "Received from" : "Paid to"} /></div>
                                    {r.direction === "out"
                                      ? <div className="w-48"><Select aria-label={`Expense head, line ${r.index + 1}`} value={d.head ?? ""} onChange={(e) => patch(r, { head: e.target.value || undefined, headName: (categories ?? []).find((c) => c._id === e.target.value)?.name })} options={(categories ?? []).filter((c) => c.active !== false).map((c) => ({ value: c._id, label: c.name }))} placeholder="Head (else Sundry)" /></div>
                                      : <div className="w-48"><Select aria-label={`Income, line ${r.index + 1}`} value={d.incomeLedger ?? ""} onChange={(e) => patch(r, { incomeLedger: e.target.value === "interest" ? "interest" : undefined })} options={[{ value: "", label: "Other income (by name)" }, { value: "interest", label: "Interest received" }]} /></div>}
                                  </>
                                ) : (
                                  <div className="w-56"><PartyPicker partyType={r.direction === "in" ? "customer" : "supplier"} label="" value={d?.party ?? ""} onChange={(id, name) => setParty(r, id, name)} /></div>
                                )}
                                {!d?.notOnFile && (r.candidates?.length ? <span className="text-xs text-ink-400">maybe {r.candidates.map((c) => `${c.partyName} (${c.docNo})`).join(", ")}</span> : <span className="text-xs text-ink-400">nothing open for this amount</span>)}
                                {d?.notOnFile
                                  ? <Button size="sm" variant="ghost" onClick={() => patch(r, { partyType: "other", notOnFile: false, partyName: "", party: undefined, use: false, keep: false, contra: undefined, head: undefined, incomeLedger: undefined })}>{r.direction === "in" ? "A customer" : "A supplier"}</Button>
                                  : <Button size="sm" variant="ghost" onClick={() => setOther(r)}>{r.direction === "in" ? "Not a customer" : "Not a supplier"}</Button>}
                                {!d?.contra && ownAccounts.length > 0 && <Button size="sm" variant="ghost" onClick={() => setTransfer(r, (ownAccounts.find((a) => a.kind === "cash") ?? ownAccounts[0])._id)}><ArrowLeftRight className="h-4 w-4" /> Own account</Button>}
                                {result.statement && <Button size="sm" variant="ghost" onClick={() => setIgnoring(r)}><EyeOff className="h-4 w-4" /> Set aside</Button>}
                              </div>
                              {d?.use && !d.contra && (d.party || (d.notOnFile && d.partyName)) && (
                                <label className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                                  <input type="checkbox" aria-label={`Remember this payer, line ${r.index + 1}`} checked={!!d.keep} onChange={(e) => patch(r, { keep: e.target.checked, ...(e.target.checked && !d.remember?.trim() ? { remember: guessAlias(r.narration) || r.narration.slice(0, 40).toUpperCase() } : {}) })} />
                                  Remember: next time a line says
                                  <input aria-label={`Remember text, line ${r.index + 1}`} className="h-7 w-48 rounded border border-ink-200 bg-surface px-2 font-mono text-xs uppercase" value={d.remember ?? ""} onChange={(e) => patch(r, { remember: e.target.value.toUpperCase() })} disabled={!d.keep} />
                                  it is {d.partyName || "this party"}
                                  {d.keep && !!d.remember?.trim() && !r.narration.toUpperCase().replace(/\s+/g, " ").includes(d.remember.trim()) && <span className="text-status-danger">— not in this line's narration, so it won't be remembered</span>}
                                </label>
                              )}
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
              <p className="mt-2 text-xs text-ink-400">Post them from "Past statements" (Match and post), or set them aside there.</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/** How a row says it was in the books before this posting. */
const ALREADY = "already in the books";
const wasThere = (x: StatementPostResult) => !!(x.already || x.replay);

const LINE_TONE: Record<StoredStatementLine["status"], "success" | "info" | "warning" | "neutral"> = { recorded: "success", posted: "info", matched: "warning", unmatched: "warning", ignored: "neutral" };

function PastView({ account, initial = null, onMatch }: { account: string; initial?: string | null; onMatch?: (statement: string) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(initial);
  const [ignoring, setIgnoring] = useState<StoredStatementLine | null>(null);
  const list = useQuery({ queryKey: [ACCOUNTS_KEY, "statements", account], queryFn: () => accountsService.statements(account) });
  const one = useQuery({ queryKey: [ACCOUNTS_KEY, "statement-stored", open], queryFn: () => accountsService.storedStatement(open!), enabled: !!open });
  const toPlace = (one.data?.lines ?? []).filter((l) => l.status === "unmatched" || l.status === "matched").length;
  const [unlinking, setUnlinking] = useState<number | null>(null);
  // A line matched to the wrong entry: back to be placed, and the entry free for its own line.
  const unlink = async (l: StoredStatementLine) => {
    if (!open) return;
    setUnlinking(l.index);
    try {
      await accountsService.unlinkLine(open, l.index);
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
      toast(`${l.voucherNo || "The entry"} is off this line — the line is back to be placed`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not undo the match", "error");
    } finally {
      setUnlinking(null);
    }
  };
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
        <h3 className="font-semibold">Statements</h3>
        {list.isLoading ? <Skeleton className="mt-2 h-24 w-full" /> : (list.data ?? []).length === 0 ? <p className="mt-2 text-sm text-ink-400">No statement for this account yet.</p> : (
          <ul className="mt-2 divide-y divide-ink-100 text-sm">
            {(list.data ?? []).map((s) => (
              <li key={s._id}>
                <button className={`w-full py-2 text-left ${open === s._id ? "text-brand-600" : ""}`} onClick={() => setOpen(s._id)}>
                  <span className="font-medium">{s.file || "Statement"}</span>{s.source === "email" && <StatusChip tone="neutral" className="ml-2">by email</StatusChip>}
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
            {toPlace > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-sm text-ink-500">{toPlace} line{toPlace === 1 ? "" : "s"} not in the books. Set aside what is not for the books, or match and post the rest.</p>
                {onMatch && <Button size="sm" variant="secondary" onClick={() => onMatch(open)}>Match and post</Button>}
              </div>
            )}
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-ink-100">
                  {one.data.lines.map((l) => (
                    <tr key={l.index}>
                      <td className="py-1.5 pr-2 whitespace-nowrap text-ink-500">{formatDate(l.date)}</td>
                      <td className="py-1.5 pr-2"><span className="block max-w-sm truncate" title={l.narration}>{l.narration}</span></td>
                      <td className={`py-1.5 pr-2 text-right tabular-nums ${l.direction === "in" ? "text-status-success" : ""}`}>{l.direction === "in" ? "+" : "−"}{money(l.amount)}</td>
                      <td className="py-1.5"><StatusChip tone={LINE_TONE[l.status]}>{l.voucherNo || (l.status === "matched" ? "suggested, not posted" : l.status === "unmatched" ? "to place" : l.status)}</StatusChip>{l.note && <span className="ml-1 text-xs text-ink-400">{l.note}</span>}</td>
                      <td className="py-1.5 pl-2 text-right">
                        {(l.status === "unmatched" || l.status === "matched") && <Button size="sm" variant="ghost" onClick={() => setIgnoring(l)}><EyeOff className="h-4 w-4" /> Set aside</Button>}
                        {/* Matched to an entry that was already in the books: the match can be undone here.
                            A voucher posted from the line is undone by cancelling the voucher. */}
                        {l.status === "recorded" && l.voucher && (
                          <InlineConfirm question={`Take ${l.voucherNo || "the entry"} off this line?`} confirmLabel="Undo the match" loading={unlinking === l.index} onConfirm={() => unlink(l)}
                            title="Matched to the wrong entry? The line goes back to be placed">
                            <Unlink className="h-4 w-4" /> Undo match
                          </InlineConfirm>
                        )}
                      </td>
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
