import { CalendarClock, CalendarOff, Gauge, Home, Wallet, type LucideIcon } from "lucide-react";
import { allNavItems, type NavSection } from "@/app/navigation";

// ══════════════════════════════════════════════════════════════════
//  WHAT AN EMPLOYEE LOGIN IS SHOWN
//
//  "My work" is not part of navSections on purpose: those items ARE the
//  feature keys an admin ticks on the Users screen. These screens are not
//  a permission anyone grants — they are a worker's own records, open to
//  any login linked to an employee and scoped by the server to that
//  employee. Keeping them out of the catalog means no tickbox, no
//  migration, and no change to any existing access rule.
// ══════════════════════════════════════════════════════════════════

export interface WorkTab {
  path: string;
  label: string;
  icon: LucideIcon;
  /** false: in the menu, not on the phone's bottom bar (it holds four). */
  bottom?: boolean;
}

/** The employee view's screens, in menu order. */
export const MY_WORK: WorkTab[] = [
  { path: "/my", label: "Home", icon: Home },
  { path: "/my/shift", label: "My shift", icon: CalendarClock },
  { path: "/my/leave", label: "Leave", icon: CalendarOff },
  // Off the bottom bar for Leave: Home's tiles open it in one tap.
  { path: "/my/performance", label: "Performance", icon: Gauge, bottom: false },
  { path: "/my/pay", label: "Pay", icon: Wallet },
];

/** The four on the phone's bottom bar. */
export const MY_WORK_TABS = MY_WORK.filter((t) => t.bottom !== false);

/**
 * The plant screens an employee keeps: notices, reporting an issue,
 * feedback and their settings. Ask Jarvis is left out: without the
 * manager features its tools are withheld (api/assistant.js), so it
 * could answer nothing useful about the floor.
 */
export const EMPLOYEE_SHARED_PATHS = ["/announcements", "/machine-issues", "/feedback", "/settings"];

export function myWorkSection(label = "My work"): NavSection {
  return { label, items: MY_WORK.map((t) => ({ label: t.label === "Home" ? "My day" : t.label, path: t.path, icon: t.icon })) };
}

/** The whole menu for an employee login. */
export function employeeSections(): NavSection[] {
  const shared = EMPLOYEE_SHARED_PATHS
    .map((p) => allNavItems.find((i) => i.path === p))
    .filter((i): i is NonNullable<typeof i> => !!i);
  return [myWorkSection(), { label: "Plant", items: shared }];
}
