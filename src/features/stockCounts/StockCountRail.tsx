import { ProgressRail, settle, type RailStep } from "@/components/ui/ProgressRail";
import { formatDate } from "@/core/format/date";
import { rupees } from "@/core/format/money";
import type { StockCount } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A STOCK COUNT, FROM OPENING TO POSTING
//
//  Opened (the system's figures frozen) → counted (every line has a
//  figure) → differences reviewed (every line that differs has its
//  reason) → posted (the stock corrected). The server moves a count to
//  review by itself once every line is counted, and refuses to post a
//  line that differs without a reason; the rail says the same.
// ══════════════════════════════════════════════════════════════════

export function stockCountSteps(count: Pick<StockCount, "status" | "frozenAt" | "postedAt" | "totals" | "postedSummary">): RailStep[] {
  const t = count.totals;
  const posted = count.status === "posted";
  const ps = count.postedSummary;
  const counted = posted || t.uncounted === 0;
  return settle([
    { key: "opened", label: "Opened", done: true, detail: count.frozenAt ? `Frozen ${formatDate(count.frozenAt)}` : undefined },
    {
      key: "counted",
      label: "Counted",
      done: counted,
      detail: posted && ps ? `${ps.linesCounted} lines counted` : `${t.counted} of ${t.lines} lines`,
    },
    {
      key: "reviewed",
      label: "Differences reviewed",
      done: posted || (counted && t.needingReason === 0),
      detail: posted && ps
        ? `${ps.linesVaried} differed`
        : t.needingReason > 0
          ? `${t.needingReason} need${t.needingReason === 1 ? "s" : ""} a reason`
          : t.varied > 0
            ? `${t.varied} differ`
            : counted ? "No differences" : undefined,
    },
    {
      key: "posted",
      label: "Posted",
      done: posted,
      detail: posted
        ? `${count.postedAt ? formatDate(count.postedAt) : "Posted"} · net ${rupees(ps?.netValue ?? 0)}`
        : undefined,
    },
  ]);
}

export function StockCountRail({ count }: { count: StockCount }) {
  if (count.status === "cancelled") return null;
  return <ProgressRail label="Count progress" steps={stockCountSteps(count)} className="mb-4" />;
}
