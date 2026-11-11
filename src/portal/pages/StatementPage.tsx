import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { formatDate } from "@/core/format/date";
import { rupees, rupeesPrecise } from "@/core/format/money";
import { portal, pdfUrl, PortalError } from "../api";
import { PageTitle, PdfLink } from "../ui";
import { NotFoundPage } from "./NotFoundPage";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** The financial year so far: from 1 April. */
export function yearSoFar(today = new Date()) {
  const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return { from: `${y}-04-01`, to: iso(today) };
}
const amount = (n: number) => (n ? rupeesPrecise(n) : "");

export function StatementPage() {
  const [range, setRange] = useState(yearSoFar);
  const q = useQuery({ queryKey: ["portal", "statement", range.from, range.to], queryFn: () => portal.statement(range.from, range.to) });

  if (q.isError && q.error instanceof PortalError && q.error.status === 403) return <NotFoundPage />;
  const s = q.data;

  return (
    <>
      <PageTitle
        title="Statement of account"
        sub="Every invoice, payment and note on your account, with the balance after each."
        aside={<PdfLink href={pdfUrl("/statement/pdf", range)}>Statement PDF</PdfLink>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatTile label="Owed now" value={s ? rupees(s.owed.total) : "—"} loading={q.isLoading} size="sm" />
        <StatTile
          label="Overdue"
          value={s ? rupees(s.owed.overdue) : "—"}
          tone={s && s.owed.overdue > 0 ? "warning" : "default"}
          loading={q.isLoading}
          size="sm"
        />
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-3 print:hidden">
        <Input label="From" type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} />
        <Input label="To" type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} />
      </div>
      {s && (
        <Card className="overflow-hidden sm:hidden">
          <ul className="divide-y divide-ink-100" aria-label="Statement entries">
            <li className="flex justify-between gap-3 bg-surface-muted/60 px-4 py-3 text-sm font-medium">
              <span>Opening balance</span>
              <span className="tabular-nums">{rupeesPrecise(s.opening)} {s.openingSide}</span>
            </li>
            {s.rows.map((r, i) => (
              <li key={`${r.number}-${i}`} className={`flex justify-between gap-3 px-4 py-3 text-sm ${r.memo ? "text-ink-400" : ""}`}>
                <div className="min-w-0">
                  <p className="text-xs text-ink-500">{formatDate(r.date)}{r.number ? ` · ${r.number}` : ""}</p>
                  <p className="truncate">{r.particulars}</p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p className="font-medium">{r.debit ? `${rupeesPrecise(r.debit)} Dr` : r.credit ? `${rupeesPrecise(r.credit)} Cr` : ""}</p>
                  <p className="text-xs text-ink-500">Balance {rupeesPrecise(r.balance)} {r.side}</p>
                </div>
              </li>
            ))}
            {s.rows.length === 0 && <li className="px-4 py-4 text-center text-sm text-ink-500">Nothing on the account in these dates.</li>}
            <li className="flex justify-between gap-3 px-4 py-3 text-sm font-semibold">
              <span>Closing balance</span>
              <span className="tabular-nums">{rupeesPrecise(s.closing)} {s.closingSide}</span>
            </li>
          </ul>
        </Card>
      )}
      <Card className={s ? "hidden overflow-hidden sm:block" : "overflow-hidden"}>
        {q.isLoading || !s ? (
          <div className="p-5">{q.isError ? <p className="text-sm text-ink-500">{(q.error as Error).message}</p> : <Skeleton className="h-48 w-full" />}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-surface-muted text-left text-xs font-medium text-ink-500">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Particulars</th>
                  <th className="px-3 py-2.5">No.</th>
                  <th className="px-3 py-2.5 text-right">Debit</th>
                  <th className="px-3 py-2.5 text-right">Credit</th>
                  <th className="px-4 py-2.5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                <tr className="bg-surface-muted/60">
                  <td className="px-4 py-2.5 text-ink-500">{formatDate(range.from)}</td>
                  <td className="px-3 py-2.5 font-medium" colSpan={4}>Opening balance</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">{rupeesPrecise(s.opening)} {s.openingSide}</td>
                </tr>
                {s.rows.map((r, i) => (
                  <tr key={`${r.number}-${i}`} className={r.memo ? "text-ink-400" : undefined}>
                    <td className="whitespace-nowrap px-4 py-2.5">{formatDate(r.date)}</td>
                    <td className="px-3 py-2.5">
                      {r.particulars}
                      {(r.type && !r.particulars.endsWith(r.type)) || r.reference ? (
                        <span className="block text-xs text-ink-500">
                          {[r.type && !r.particulars.endsWith(r.type) ? r.type : "", r.reference].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink-600">{r.number}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{amount(r.debit)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{amount(r.credit)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{rupeesPrecise(r.balance)} {r.side}</td>
                  </tr>
                ))}
                {s.rows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-4 text-center text-sm text-ink-500">Nothing on the account in these dates.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink-200 font-semibold">
                  <td className="px-4 py-3" colSpan={5}>Closing balance</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{rupeesPrecise(s.closing)} {s.closingSide}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-ink-500">Dr means you owe the balance; Cr means it is in your favour.</p>
    </>
  );
}
