import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { quoteService } from "./api";
import type { QuoteWinLoss, WinLossBand, WinLossPoint } from "./types";

// ══════════════════════════════════════════════════════════════════
//  WHAT YOUR OWN QUOTES SAY ABOUT YOUR PRICING
//
//  Quote.status has recorded accepted / declined / expired since the
//  module was built, and nothing ever read it. This panel does.
//
//  It reports history. It does not fill in a price, no field on the
//  quote form is bound to it, and it is deliberately rendered beside
//  the pricing rather than inside it — the person still names the
//  number, with this in view.
// ══════════════════════════════════════════════════════════════════

type Window = "all" | "365" | "180";

/** Colour by how far a rate sits from the plant baseline, not absolutely. */
function bandTone(rate: number | null, baseline: number | null) {
  if (rate == null || baseline == null) return "neutral" as const;
  if (rate >= baseline + 15) return "success" as const;
  if (rate <= baseline - 15) return "danger" as const;
  return "neutral" as const;
}

function BandRow({ b, baseline }: { b: WinLossBand; baseline: number | null }) {
  const empty = b.quotes === 0;
  return (
    <tr className="border-t border-ink-100">
      <td className="py-2 pr-4 whitespace-nowrap">{b.band}</td>
      <td className="py-2 pr-4 tabular-nums text-ink-500">
        {empty ? <span className="text-ink-300">—</span> : `${b.wins} of ${b.quotes}`}
      </td>
      <td className="py-2 pr-4">
        {empty ? (
          // Never a zero for a band nobody has quoted in. "0%" would
          // read as "we always lose here", which is a different claim.
          <span className="text-sm text-ink-300">no quotes</span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-ink-100">
              <div
                className={cn(
                  "h-full rounded-full",
                  bandTone(b.winRatePct, baseline) === "success" ? "bg-status-success"
                    : bandTone(b.winRatePct, baseline) === "danger" ? "bg-status-danger"
                    : "bg-brand-500"
                )}
                style={{ width: `${b.winRatePct}%` }}
              />
            </div>
            <span className="tabular-nums text-sm font-medium">{b.winRatePct}%</span>
            {b.thin && (
              <span className="text-xs text-ink-400" title="Too few quotes in this band to read much into">
                thin
              </span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

/**
 * The curve, as a plain SVG.
 *
 * No chart library: two series over twelve points does not justify a
 * dependency, and the shape people need to see — win probability
 * falling as the expected return peaks and then falls — reads better
 * without one.
 */
function Curve({ curve, best }: { curve: WinLossPoint[]; best?: number }) {
  if (curve.length < 2) return null;

  const W = 520, H = 150, pad = 28;
  const xs = (m: number) => pad + (m / 60) * (W - pad * 2);
  const maxExp = Math.max(...curve.map((c) => c.expectedMarginPoints), 1);

  const line = (get: (c: WinLossPoint) => number, max: number) =>
    curve.map((c, i) =>
      `${i === 0 ? "M" : "L"} ${xs(c.marginPct).toFixed(1)} ${(H - pad - (get(c) / max) * (H - pad * 2)).toFixed(1)}`
    ).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[420px]" role="img"
           aria-label="Win probability and expected return against margin">
        {[0, 25, 50, 75, 100].map((p) => (
          <line key={p} x1={pad} x2={W - pad}
                y1={H - pad - (p / 100) * (H - pad * 2)} y2={H - pad - (p / 100) * (H - pad * 2)}
                className="stroke-ink-100" strokeWidth="1" />
        ))}
        {best != null && (
          <line x1={xs(best)} x2={xs(best)} y1={pad / 2} y2={H - pad}
                className="stroke-status-success" strokeWidth="1.5" strokeDasharray="3 3" />
        )}
        <path d={line((c) => c.winProbabilityPct, 100)} fill="none"
              className="stroke-brand-500" strokeWidth="2" />
        <path d={line((c) => c.expectedMarginPoints, maxExp)} fill="none"
              className="stroke-status-success" strokeWidth="2" strokeDasharray="4 3" />
        {[0, 20, 40, 60].map((m) => (
          <text key={m} x={xs(m)} y={H - 8} textAnchor="middle"
                className="fill-ink-400 text-[10px]">{m}%</text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 text-xs text-ink-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-brand-500" /> chance of winning
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-status-success" />
          expected return (chance × margin)
        </span>
      </div>
    </div>
  );
}

function Body({ data }: { data: QuoteWinLoss }) {
  if (data.quotes === 0) {
    return (
      <p className="mt-3 text-sm text-ink-400">
        No quotes have been accepted or declined in this window yet. Mark quotes as
        accepted or declined as you hear back, and this fills in on its own.
      </p>
    );
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span>
          <span className="text-2xl font-bold tabular-nums">{data.baselineWinRatePct}%</span>
          <span className="ml-2 text-ink-400">won overall</span>
        </span>
        <span className="text-ink-500 tabular-nums">
          {data.wins} won · {data.losses} lost
          {/* Apart, because they are not the same evidence: a decline is
              the customer saying no, an expiry may be a quote nobody
              chased. */}
          {data.losses > 0 && (
            <span className="text-ink-400">
              {" "}({data.lossBreakdown.declined} declined, {data.lossBreakdown.expired} expired)
            </span>
          )}
        </span>
        <StatusChip tone={data.estimator === "logistic" ? "info" : "neutral"}>
          {data.estimator === "logistic" ? "fitted curve" : "observed history"}
        </StatusChip>
      </div>

      {data.note && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {data.note}
        </p>
      )}

      {data.estimator === "logistic" && (
        <div className="mt-4">
          <Curve curve={data.curve} best={data.bestExpectedMarginPct} />
          {data.bestExpectedMarginPct != null && (
            <p className="mt-2 text-sm">
              Best expected return sits around{" "}
              <span className="font-semibold">{data.bestExpectedMarginPct}%</span> margin
              {" — "}
              <span className="text-ink-400">
                the cheapest price wins most often and earns least, so the peak is not the
                left-hand edge.
              </span>
            </p>
          )}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="pb-2 pr-4 font-medium">Margin</th>
              <th className="pb-2 pr-4 font-medium">Won</th>
              <th className="pb-2 pr-4 font-medium">Win rate</th>
            </tr>
          </thead>
          <tbody>
            {data.bands.map((b) => (
              <BandRow key={b.band} b={b} baseline={data.baselineWinRatePct} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function WinLossPanel({ customerId }: { customerId?: string }) {
  const [win, setWin] = useState<Window>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["quote-win-loss", win, customerId ?? null],
    queryFn: () =>
      quoteService.winLoss({
        days: win === "all" ? undefined : Number(win),
        customerId,
      }),
    staleTime: 60_000,
  });

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
            <TrendingUp className="h-4 w-4" /> Pricing history
          </h2>
          <p className="mt-1 max-w-xl text-xs text-ink-400">
            How often quotes at each margin were accepted. This is a record of what
            happened — it does not set a price, and it knows nothing about the
            conversation behind any of these.
          </p>
        </div>
        <FilterChips<Window>
          options={[
            { value: "all", label: "All time" },
            { value: "365", label: "12 months" },
            { value: "180", label: "6 months" },
          ]}
          value={win}
          onChange={setWin}
        />
      </div>

      {isLoading ? <Skeleton className="mt-4 h-40 w-full" /> : data ? <Body data={data} /> : null}
    </Card>
  );
}

export default WinLossPanel;
