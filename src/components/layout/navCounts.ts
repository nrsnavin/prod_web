import { useMemo } from "react";
import { allNavItems } from "@/app/navigation";
import type { AttentionItem } from "@/features/dashboard/api";
import { useDashboardOverview } from "@/features/dashboard/hooks";

// ══════════════════════════════════════════════════════════════════
//  WHAT IS WAITING, ON THE MENU
//
//  The dashboard's attention list (shifts to verify, orders at risk,
//  invoices waiting for an IRN, low stock…) also shows as a count on
//  the menu entry that clears it, so it is seen from any page. The same
//  query and cache as the dashboard: nothing is counted twice, and the
//  numbers on the menu and on the home screen always agree.
// ══════════════════════════════════════════════════════════════════

export interface NavCount {
  count: number;
  tone: "warning" | "danger";
  /** "Orders at risk: 3", one per attention item. */
  says: string[];
}

/** The menu entry a link belongs to: the longest entry path it starts with. */
export function navPathFor(to: string): string | undefined {
  const path = to.split("?")[0];
  return allNavItems
    .filter((i) => i.path !== "/" && (path === i.path || path.startsWith(i.path + "/")))
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;
}

export function navCounts(attention: AttentionItem[]): Map<string, NavCount> {
  const m = new Map<string, NavCount>();
  for (const a of attention) {
    if (!a.count) continue;
    const p = navPathFor(a.to);
    if (!p) continue;
    const c = m.get(p) ?? { count: 0, tone: "warning" as const, says: [] };
    c.count += a.count;
    if (a.tone === "danger") c.tone = "danger";
    c.says.push(`${a.label}: ${a.count}`);
    m.set(p, c);
  }
  return m;
}

/** The server builds the overview for these roles only; others aren't asked. */
const OVERVIEW_ROLES = ["admin", "production", "accounts"];

export function useNavCounts(user: { role?: string; selfService?: boolean } | null | undefined) {
  const enabled = !!user && !user.selfService && OVERVIEW_ROLES.includes(user.role ?? "");
  const q = useDashboardOverview(enabled);
  return useMemo(() => navCounts(q.data?.attention ?? []), [q.data]);
}
