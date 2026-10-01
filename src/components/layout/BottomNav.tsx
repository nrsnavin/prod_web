import { NavLink } from "react-router-dom";
import { LayoutDashboard, Menu, type LucideIcon } from "lucide-react";
import { allNavItems, canAccess, effectiveDepartment, type AccessCtx } from "@/app/navigation";
import { useAuth } from "@/core/auth/useAuth";
import { cn } from "@/components/ui/cn";
import { MY_WORK } from "@/features/me/employeeNav";

// ══════════════════════════════════════════════════════════════════
//  FOUR SCREENS UNDER THE THUMB
//
//  On a phone every move used to go through the hamburger at the top
//  left, and an admin's menu was 44 links, 14 of them on screen. The
//  screens a department opens all day now sit in a bar at the bottom,
//  one tap away; "More" opens the full menu for everything else.
//
//  Which four depends on the department, and each is shown only if
//  this user may open it (the same rule as the menu, per-user feature
//  lists included), so the bar never offers a screen that bounces.
// ══════════════════════════════════════════════════════════════════

/** Preferred tabs per department, in order. Home is always first. */
export const TAB_PREFERENCES: Record<string, string[]> = {
  admin: ["/orders", "/jobs", "/machines"],
  production: ["/jobs", "/machines", "/shift-plans"],
  packing: ["/packing", "/qc", "/jobs"],
  finance: ["/orders", "/customers", "/materials"],
};

/** Shorter names where the menu's label would not fit under an icon. */
const SHORT: Record<string, string> = {
  "/jobs": "Jobs",
  "/shift-plans": "Shifts",
  "/qc": "QC",
  "/materials": "Materials",
  "/delivery-challans": "DCs",
  "/machine-issues": "Issues",
};

export interface Tab {
  path: string;
  label: string;
  icon: LucideIcon;
}

/** Home plus up to three screens this user may open. Pure, for tests. */
export function tabsFor(user: AccessCtx & object | null | undefined): Tab[] {
  const dept = effectiveDepartment(user as { role?: string; department?: string | null }) ?? "";
  const allowed = allNavItems.filter((i) => i.path !== "/" && canAccess(i, user));
  const byPath = new Map(allowed.map((i) => [i.path, i]));
  const picked: string[] = [];
  for (const p of TAB_PREFERENCES[dept] ?? []) if (byPath.has(p) && picked.length < 3) picked.push(p);
  // A department with no preference, or preferences it may not open,
  // gets its first accessible screens instead of an empty bar.
  for (const i of allowed) if (picked.length < 3 && !picked.includes(i.path)) picked.push(i.path);
  return [
    { path: "/", label: "Home", icon: LayoutDashboard },
    ...picked.map((p) => {
      const item = byPath.get(p)!;
      return { path: p, label: SHORT[p] ?? item.label, icon: item.icon };
    }),
  ];
}

const tabClass = (active: boolean) =>
  cn(
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium",
    "transition-colors active:bg-ink-100/60",
    active ? "text-brand-600" : "text-ink-500"
  );

export function BottomNav({ onMore }: { onMore: () => void }) {
  const { user } = useAuth();
  // An employee login's four: their day, their shift, how they did, pay.
  const tabs = user?.selfService ? MY_WORK : tabsFor(user);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-100 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
    >
      <div className="mx-auto flex max-w-lg pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        {tabs.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} end={path === "/" || path === "/my"} className={({ isActive }) => tabClass(isActive)}>
            {({ isActive }) => (
              <>
                <Icon className={cn("h-[22px] w-[22px]", isActive && "stroke-[2.25]")} aria-hidden />
                <span className="max-w-full truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button type="button" onClick={onMore} className={tabClass(false)}>
          <Menu className="h-[22px] w-[22px]" aria-hidden />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
