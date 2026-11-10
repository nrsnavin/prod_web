import { NavLink } from "react-router-dom";
import { X, PanelLeftClose, PanelLeftOpen, Pin, PinOff } from "lucide-react";
import { visibleSections, applyNavPrefs, type NavItem } from "@/app/navigation";
import { useAuth } from "@/core/auth/useAuth";
import { cn } from "@/components/ui/cn";
import { config } from "@/app/config";
import { useUiStore } from "@/core/ui/uiStore";
import { LogoutButton } from "./LogoutButton";
import { employeeSections, myWorkSection } from "@/features/me/employeeNav";
import { BrandMark } from "./BrandMark";
import { useNavCounts, type NavCount } from "./navCounts";

export interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { user } = useAuth();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const navHidden = useUiStore((s) => s.navHidden);
  const navOrder = useUiStore((s) => s.navOrder);
  // An employee login gets its own short menu; a manager who is also on
  // the payroll gets theirs plus "My work" at the end.
  const sections = user?.selfService
    ? employeeSections()
    : [
        ...applyNavPrefs(visibleSections(user), { navHidden, navOrder }),
        ...(user?.employeeId ? [myWorkSection()] : []),
      ];
  const counts = useNavCounts(user);
  // Pinned entries lead the menu. They are looked up among the entries
  // this person may open, so a pin never shows a page they've lost.
  const navPinned = useUiStore((s) => s.navPinned);
  const togglePinned = useUiStore((s) => s.togglePinned);
  const pinnable = !user?.selfService;
  const pinnedSet = new Set(navPinned);
  const reachable = pinnable ? visibleSections(user).flatMap((sec) => sec.items) : [];
  const pinnedItems = navPinned
    .map((p) => reachable.find((i) => i.path === p))
    .filter((i): i is NavItem => !!i);
  const shown = pinnedItems.length ? [{ label: "Pinned", items: pinnedItems }, ...sections] : sections;

  return (
    <>
      {/* Mobile scrim */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 app-scrim lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-surface border-r border-ink-100 flex flex-col",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
          "transition-all lg:translate-x-0",
          collapsed ? "w-64 lg:w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className={cn("flex items-center justify-between h-16 border-b border-ink-100", collapsed ? "px-5 lg:px-0 lg:justify-center" : "px-5")}>
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-logo text-white grid place-items-center">
              <BrandMark className="h-6 w-6" />
            </span>
            <span className={cn("font-bold text-lg tracking-tight", collapsed && "lg:hidden")}>
              {config.appName}
            </span>
          </div>
          <button
            className="lg:hidden p-1 rounded-lg text-ink-400 hover:bg-ink-100"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {shown.map((section) => (
            <div key={section.label}>
              <p className={cn("px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400", collapsed && "lg:hidden")}>
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <NavRow
                    key={item.path}
                    item={item}
                    count={counts.get(item.path)}
                    collapsed={collapsed}
                    pinned={pinnable ? pinnedSet.has(item.path) : undefined}
                    onTogglePin={() => togglePinned(item.path)}
                    onNavigate={onMobileClose}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Phone menu: log out lives here, not in the cramped top bar. */}
        <div className="border-t border-ink-100 p-3 sm:hidden">
          <LogoutButton className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900" />
        </div>

        {/* Desktop collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="hidden lg:flex items-center justify-center gap-2 h-11 border-t border-ink-100 text-ink-400 hover:text-ink-900 hover:bg-ink-100/60 text-sm"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          <span className={cn(collapsed && "hidden")}>Collapse</span>
        </button>
      </aside>
    </>
  );
}

/**
 * One menu entry: its count of what is waiting, and a pin that shows on
 * hover or keyboard focus. The pin is a button beside the link, never
 * inside it, so each is reached and announced on its own.
 */
function NavRow({
  item: { label, path, icon: Icon },
  count,
  collapsed,
  pinned,
  onTogglePin,
  onNavigate,
}: {
  item: NavItem;
  count?: NavCount;
  collapsed: boolean;
  /** undefined: this menu has no pins (an employee login). */
  pinned?: boolean;
  onTogglePin: () => void;
  onNavigate: () => void;
}) {
  const shownCount = count ? (count.count > 99 ? "99+" : String(count.count)) : null;
  return (
    <li className="group relative">
      <NavLink
        to={path}
        end={path === "/" || path === "/my"}
        onClick={onNavigate}
        title={count ? `${label} · ${count.says.join(" · ")}` : label}
        // Named outright: collapsed to icons the label is hidden, and a
        // count reads as part of the name, "Orders, Orders at risk: 2".
        aria-label={count ? `${label}, ${count.says.join(", ")}` : label}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            collapsed && "lg:justify-center lg:px-0",
            // Room for the pin, which sits over the row's right end.
            pinned !== undefined && cn("pr-9", collapsed && "lg:pr-0"),
            isActive
              ? "bg-brand-50 text-brand-600"
              : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
          )
        }
      >
        <span className="relative shrink-0">
          <Icon className="h-[18px] w-[18px]" />
          {/* Collapsed to icons, a count becomes a dot. */}
          {count && collapsed && (
            <span
              aria-hidden
              className={cn(
                "absolute -right-1 -top-1 hidden h-2 w-2 rounded-full lg:block",
                count.tone === "danger" ? "bg-status-danger" : "bg-status-warning"
              )}
            />
          )}
        </span>
        <span className={cn("min-w-0 flex-1 truncate", collapsed && "lg:hidden")}>{label}</span>
        {count && (
            <span
              aria-hidden
              className={cn(
                "shrink-0 rounded-full px-1.5 text-[11px] font-semibold leading-5 tabular-nums transition-opacity",
                count.tone === "danger" ? "bg-status-dangerBg text-status-danger" : "bg-ink-100 text-ink-600",
                // The pin takes the count's place while it shows.
                pinned !== undefined && "group-hover:opacity-0 group-has-[:focus-visible]:opacity-0",
                collapsed && "lg:hidden"
              )}
            >
              {shownCount}
            </span>
        )}
      </NavLink>
      {pinned !== undefined && (
        <button
          type="button"
          onClick={onTogglePin}
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${label}` : `Pin ${label} to the top`}
          title={pinned ? "Unpin" : "Pin to the top"}
          className={cn(
            "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 opacity-0 transition-opacity",
            "hover:bg-ink-200/70 hover:text-ink-900 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100",
            collapsed && "lg:hidden"
          )}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
      )}
    </li>
  );
}
