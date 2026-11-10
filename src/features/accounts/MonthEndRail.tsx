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
  { key: "checklist", label: "Checklist clear", items: ["photos", "approvals", "tds", "msme", "rule37", "credits"] },
  { key: "gst", label: "GST checked", items: ["gstr2b"] },
  { key: "tally", label: "Sent to Tally", items: ["tally"] },
  { key: "lock", label: "Books locked", items: ["lock"] },
];

export function monthEndSteps(items: Array<Pick<CloseItem, "key" | "ok" | "detail">>): RailStep[] {
  const byKey = new Map(items.map((i) => [i.key, i]));
  return settle(
    GROUPS.map((g) => {
      const mine = g.items.map((k) => byKey.get(k)).filter((i) => i != null);
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
