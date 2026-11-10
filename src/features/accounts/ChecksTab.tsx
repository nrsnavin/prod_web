import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useAuth } from "@/core/auth/useAuth";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money } from "./shared";
import type { HealthCheck } from "./types";

const val = (v: unknown) => (typeof v === "number" ? money(v) : typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? formatDate(v) : Array.isArray(v) ? v.join(", ") : String(v ?? ""));
const COLS: Record<string, Array<[string, string]>> = {
  derived: [["docNo", "Document"], ["field", "Figure"], ["stored", "Stored"], ["expected", "From its vouchers"]],
  ledger: [["partyName", "Party"], ["ledger", "Ledger"], ["documents", "Documents"], ["difference", "Difference"]],
  cancelled: [["docNo", "Document"], ["date", "Dated"]],
  renamed: [["name", "Party"], ["tallyName", "Name in Tally"], ["sentAs", "Sent as"]],
  midnight: [["docNo", "Document"], ["stored", "Stored"], ["indiaDate", "Day in India"]],
  totals: [["docNo", "Document"], ["lines", "Lines"], ["total", "Total"]],
  lock: [["docNo", "Document"], ["date", "Dated"], ["createdAt", "Entered"]],
  bank: [["file", "Statement"], ["index", "Line"], ["voucherNo", "Voucher"]],
};

function Check({ c, isAdmin, onFix, fixing }: { c: HealthCheck; isAdmin: boolean; onFix: (k: "repair" | "rebuild") => void; fixing: boolean }) {
  const cols = COLS[c.key] ?? [];
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        {c.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-success" aria-label="fine" /> : <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${c.severity === "critical" ? "text-status-danger" : "text-status-warning"}`} aria-label="needs attention" />}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{c.label}{!c.ok && <span className="ml-2 text-sm font-normal text-ink-500">{c.count}</span>}</p>
          {!c.ok && <p className="text-sm text-ink-500">{c.error ? `Could not check: ${c.error}` : c.explain}</p>}
        </div>
        {!c.ok && c.fix && isAdmin && (
          <Button size="sm" variant="secondary" loading={fixing} onClick={() => onFix(c.fix!)}><Wrench className="h-4 w-4" /> {c.fix === "repair" ? "Put the figures back" : "Rebuild the ledgers"}</Button>
        )}
      </div>
      {!c.ok && c.rows.length > 0 && cols.length > 0 && (
        <div className="mt-2 overflow-x-auto pl-8">
          <table className="w-full min-w-[420px] text-sm">
            <thead><tr className="text-xs text-ink-500 font-medium">{cols.map(([, h]) => <th key={h} className="py-1 pr-3 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-ink-100">{c.rows.map((r, i) => <tr key={i}>{cols.map(([k]) => <td key={k} className="py-1 pr-3 tabular-nums">{val(r[k])}</td>)}</tr>)}</tbody>
          </table>
          {c.count > c.rows.length && <p className="mt-1 text-xs text-ink-400">and {c.count - c.rows.length} more</p>}
        </div>
      )}
    </li>
  );
}

/**
 * The books checked against themselves and against what went to Tally:
 * figures recomputed from the vouchers behind them, ledgers against
 * documents, and the things that make Tally disagree.
 */
export function ChecksTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: [ACCOUNTS_KEY, "health"], queryFn: accountsService.booksHealth });
  const [fixing, setFixing] = useState<string | null>(null);
  const fix = async (k: "repair" | "rebuild") => {
    setFixing(k);
    try {
      const r = await accountsService.booksRepair(k);
      toast(k === "repair" ? `${r.fixed ?? 0} document${r.fixed === 1 ? "" : "s"} put back from their vouchers` : "Party ledgers rebuilt from the documents", "success");
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not fix", "error"); } finally { setFixing(null); }
  };
  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;
  const bad = data.checks.filter((c) => !c.ok).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink-500"><span className="font-semibold text-ink-900">{data.checks.length - bad} of {data.checks.length}</span> checks pass · run {formatDate(data.ranAt)}</p>
        <Button size="sm" variant="ghost" className="ml-auto" loading={isFetching} onClick={() => refetch()}>Check again</Button>
      </div>
      <Card>
        <ul className="divide-y divide-ink-100" aria-label="Books checks">
          {data.checks.map((c) => <Check key={c.key} c={c} isAdmin={isAdmin} onFix={fix} fixing={fixing === c.fix} />)}
        </ul>
      </Card>
      <p className="text-xs text-ink-400">Putting figures back recomputes each document's paid, credited and unallocated amounts from the vouchers and notes behind it; nothing else changes, and each document records what was changed. Rebuilding the ledgers re-posts every party's ledger from its documents.</p>
    </div>
  );
}
