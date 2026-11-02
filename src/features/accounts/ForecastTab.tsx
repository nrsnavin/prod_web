import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money } from "./shared";

/**
 * Cash over the coming weeks: what is in the accounts today, the money
 * each customer is expected to send (when they have actually paid in the
 * past, not when the invoice says), bills as they fall due, and the
 * recurring expenses — and the first week the cash would run short.
 */
export function ForecastTab() {
  const [weeks, setWeeks] = useState<"6" | "9" | "13">("6");
  const { data, isLoading } = useQuery({ queryKey: [ACCOUNTS_KEY, "forecast", weeks], queryFn: () => accountsService.forecast(Number(weeks)) });
  if (isLoading || !data) return <Skeleton className="h-72 w-full" />;
  const scale = Math.max(1, ...data.weeks.flatMap((w) => [w.inflow, w.outflow]));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips options={[{ value: "6", label: "6 weeks" }, { value: "9", label: "9 weeks" }, { value: "13", label: "13 weeks" }]} value={weeks} onChange={setWeeks} />
        <p className="text-sm text-ink-500">Cash and bank today <span className="font-semibold tabular-nums text-ink-900">₹{money(data.opening)}</span></p>
        {data.firstShortWeek ? <StatusChip tone="danger">Runs short the week of {formatDate(data.firstShortWeek)}</StatusChip> : <StatusChip tone="success">Stays above zero</StatusChip>}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Cash forecast">
            <thead>
              <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2 text-left font-medium">Week of</th><th className="py-2 text-left font-medium">In and out</th>
                <th className="py-2 text-right font-medium">In</th><th className="py-2 text-right font-medium">Out</th><th className="px-4 py-2 text-right font-medium">Cash at the end</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {data.weeks.map((w) => (
                <tr key={w.from} className={w.closing < 0 ? "bg-status-dangerBg/40" : ""}>
                  <td className="px-4 py-2 align-top whitespace-nowrap">{formatDate(w.from)}</td>
                  <td className="py-2 pr-3 align-top">
                    <div className="flex h-2 w-48 max-w-full overflow-hidden rounded bg-ink-50" aria-hidden><div className="bg-status-success" style={{ width: `${(w.inflow / scale) * 100}%` }} /></div>
                    <div className="mt-1 flex h-2 w-48 max-w-full overflow-hidden rounded bg-ink-50" aria-hidden><div className="bg-status-danger" style={{ width: `${(w.outflow / scale) * 100}%` }} /></div>
                    <ul className="mt-1 text-xs text-ink-500">{w.top.slice(0, 3).map((x, i) => <li key={i}>{x.direction === "in" ? "+" : "−"}₹{money(x.amount)} {x.party} <span className="text-ink-400">({x.docNo}, {x.basis})</span></li>)}</ul>
                  </td>
                  <td className="py-2 text-right align-top tabular-nums text-status-success">{w.inflow ? money(w.inflow) : "—"}</td>
                  <td className="py-2 text-right align-top tabular-nums">{w.outflow ? money(w.outflow) : "—"}</td>
                  <td className={`px-4 py-2 text-right align-top tabular-nums font-semibold ${w.closing < 0 ? "text-status-danger" : ""}`}>₹{money(w.closing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-ink-400">
        Beyond these weeks: ₹{money(data.later.inflow)} expected in, ₹{money(data.later.outflow)} out. Receipts use how each customer has paid over the last year
        {data.habits ? ` (${data.habits} customers with a history)` : ""}; customers without one are expected on their terms. Late invoices are expected next week.
      </p>
    </div>
  );
}
