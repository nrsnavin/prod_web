import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { httpClient } from "@/core/http/httpClient";
import { money } from "./shared";

// ══════════════════════════════════════════════════════════════════
//  The month in plain words: what changed against the month before and
//  the likely why. Figures are the app's; the words are checked against
//  them (services/monthCommentary.js).
// ══════════════════════════════════════════════════════════════════

export interface MonthReviewData {
  month: string;
  by: "model" | "rules";
  points: string[];
  figures: {
    label: string; previous: string;
    sales: { taxable: number; previous: number; change: number | null; metres: number; ratePerMetre: number | null };
    purchases: { taxable: number; change: number | null };
    yarn: { perMetre: number | null; change: number | null };
    expenses: { total: number };
    overdue: { amount: number; over60: number };
  };
}

const delta = (c: number | null) => (c == null ? "" : `${c >= 0 ? "▲" : "▼"} ${Math.abs(c)}%`);

export function MonthReview({ month }: { month: string }) {
  const [asked, setAsked] = useState(false);
  const { data, isFetching } = useQuery({
    queryKey: ["accounts", "month-review", month],
    queryFn: () => httpClient.get<MonthReviewData>("/accounts/month-review", { month }),
    enabled: asked,
    staleTime: 5 * 60_000,
  });
  return (
    <Card className="space-y-3 p-4" aria-label="Month review">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-ink-800">What changed this month</h3>
          <p className="text-sm text-ink-500">Sales, mix, yarn cost a metre, unusual expenses and overdue — against the month before.</p>
        </div>
        {!asked && <Button size="sm" variant="secondary" onClick={() => setAsked(true)}><Sparkles className="h-4 w-4" /> Write the month review</Button>}
      </div>
      {asked && (isFetching && !data ? <Skeleton className="h-28" /> : data && (
        <>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs uppercase tracking-wide text-ink-400">Sales</dt><dd className="font-semibold tabular-nums">{money(data.figures.sales.taxable)} <span className="text-xs text-ink-500">{delta(data.figures.sales.change)}</span></dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-400">Purchases</dt><dd className="font-semibold tabular-nums">{money(data.figures.purchases.taxable)} <span className="text-xs text-ink-500">{delta(data.figures.purchases.change)}</span></dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-400">Yarn a metre</dt><dd className="font-semibold tabular-nums">{data.figures.yarn.perMetre != null ? `₹${data.figures.yarn.perMetre}` : "—"} <span className="text-xs text-ink-500">{delta(data.figures.yarn.change)}</span></dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-400">Overdue today</dt><dd className="font-semibold tabular-nums">{money(data.figures.overdue.amount)}</dd></div>
          </dl>
          <ul role="note" className="list-disc space-y-1 pl-5 text-sm text-ink-700">{data.points.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="text-xs text-ink-400">{data.by === "model" ? "Written from the figures above; every number in it was checked against them." : "Put together from the figures above."}</p>
        </>
      ))}
    </Card>
  );
}
