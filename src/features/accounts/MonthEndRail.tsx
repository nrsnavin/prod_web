import { ProgressRail, settle, type RailStep } from "@/components/ui/ProgressRail";
import type { CloseItem } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A MONTH'S CLOSE
//
//  Bank reconciled → checklist clear → GST checked → sent to Tally →
//  books locked. Read straight off the close checklist the server works
//  out (the same one Jarvis and the WhatsApp reminder give), grouped into
//  the steps an accountant takes, in the order the checklist itself asks
//  for: the books are locked once the month has gone to Tally.
// ══════════════════════════════════════════════════════════════════

const GROUPS: Array<{ key: string; label: string; items: string[] }> = [
  { key: "bank", label: "Bank reconciled", items: ["bank", "cleared"] },
  { key: "checklist", label: "Checklist clear", items: ["photos", "approvals", "tds", "tdsOnCredit", "msme", "rule37", "credits"] },
  { key: "gst", label: "GST checked", items: ["gst", "gstr2b"] },
  { key: "tally", label: "Sent to Tally", items: ["tally"] },
  { key: "lock", label: "Books locked", items: ["lock"] },
];
// The checklist is the server's and grows there (it gained "TDS on bills
// booked and not yet paid" after this was written, and the rail read
// "Checklist clear" over it). An item no step names belongs to the
// checklist step: it holds that step open instead of being passed over.
const CATCH_ALL = "checklist";
const NAMED = new Set(GROUPS.flatMap((g) => g.items));

export function monthEndSteps(items: Array<Pick<CloseItem, "key" | "ok" | "detail">>): RailStep[] {
  const byKey = new Map(items.map((i) => [i.key, i]));
  return settle(
    GROUPS.map((g) => {
      const mine = [
        ...g.items.map((k) => byKey.get(k)).filter((i) => i != null),
        ...(g.key === CATCH_ALL ? items.filter((i) => !NAMED.has(i.key)) : []),
      ];
      const left = mine.filter((i) => !i.ok);
      return {
        key: g.key,
        label: g.label,
        done: mine.length > 0 && left.length === 0,
        // One open item says itself; several are counted.
        detail: left.length === 0 ? undefined : left.length === 1 ? left[0].detail : `${left.length} items left`,
      };
    })
  );
}

export function MonthEndRail({ items, monthLabel }: { items: CloseItem[]; monthLabel: string }) {
  return <ProgressRail label={`Closing ${monthLabel}`} steps={monthEndSteps(items)} />;
}
