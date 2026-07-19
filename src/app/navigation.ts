import {
  LayoutDashboard,
  TrendingUp,
  FileBarChart,
  ShoppingCart,
  ClipboardList,
  Truck,
  Layers,
  Disc3,
  Package,
  CalendarClock,
  ShieldCheck,
  Factory,
  Trash2,
  Users,
  Building2,
  FileText,
  Boxes,
  Cable,
  Cog,
  UserRound,
  Fingerprint,
  Wallet,
  Gift,
  CalendarOff,
  Megaphone,
  MessageSquareWarning,
  Wrench,
  BellRing,
  Sparkles,
  Database,
  Wand2,
  ScanLine,
  Bot,
  LucideIcon,
} from "lucide-react";

// Departments drive who sees what. `admin` sees everything; the four
// shop-floor departments each see a focused set. Keep this list in sync
// with utils/roles.js on the backend.
export const DEPARTMENTS = ["admin", "preparatory", "weaving", "packing", "finance"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  preparatory: "Preparatory (Warping & Covering)",
  weaving: "Weaving",
  packing: "Packing & Checking",
  finance: "Finance",
};

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Departments allowed to see this item; undefined = all authenticated users. `admin` always sees everything. */
  departments?: Department[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

// ── OCP: adding a feature = adding an entry here ────────────────────────
// The sidebar, the global search index, and the route stubs all derive
// from this one structure.
export const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", path: "/", icon: LayoutDashboard }, // all
      { label: "Analytics", path: "/analytics", icon: TrendingUp, departments: ["admin", "weaving"] },
      { label: "Reports", path: "/reports", icon: FileBarChart, departments: ["admin", "finance"] },
      { label: "Audit Trail", path: "/audit", icon: Fingerprint, departments: ["admin"] },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Orders", path: "/orders", icon: ShoppingCart, departments: ["admin", "finance"] },
      { label: "Job Orders", path: "/jobs", icon: ClipboardList, departments: ["admin", "preparatory", "weaving", "packing"] },
      { label: "Delivery Challans", path: "/delivery-challans", icon: Truck, departments: ["admin", "finance"] },
    ],
  },
  {
    label: "Production",
    items: [
      { label: "Auto Planner", path: "/planner", icon: Wand2, departments: ["admin", "weaving"] },
      { label: "Warping", path: "/warping", icon: Layers, departments: ["admin", "preparatory"] },
      { label: "Covering", path: "/covering", icon: Disc3, departments: ["admin", "preparatory"] },
      { label: "Packing", path: "/packing", icon: Package, departments: ["admin", "packing"] },
      { label: "Quality Control", path: "/qc", icon: ScanLine, departments: ["admin", "packing"] },
      { label: "Shift Plans", path: "/shift-plans", icon: CalendarClock, departments: ["admin", "weaving"] },
      { label: "Shift Verification", path: "/shift-verification", icon: ShieldCheck, departments: ["admin", "weaving"] },
      { label: "Production View", path: "/production", icon: Factory, departments: ["admin", "weaving"] },
      { label: "Wastage", path: "/wastage", icon: Trash2, departments: ["admin", "weaving"] },
    ],
  },
  {
    label: "Masters",
    items: [
      { label: "Customers", path: "/customers", icon: Users, departments: ["admin", "finance"] },
      { label: "Suppliers", path: "/suppliers", icon: Building2, departments: ["admin", "finance"] },
      { label: "Purchase Orders", path: "/purchase-orders", icon: FileText, departments: ["admin", "finance"] },
      { label: "Raw Materials", path: "/materials", icon: Boxes, departments: ["admin", "finance"] },
      { label: "Elastic Products", path: "/elastics", icon: Cable, departments: ["admin", "finance"] },
      { label: "Elastic Groups", path: "/elastic-groups", icon: Layers, departments: ["admin"] },
      { label: "Machines", path: "/machines", icon: Cog, departments: ["admin", "weaving"] },
      { label: "Employees", path: "/employees", icon: UserRound, departments: ["admin", "finance"] },
    ],
  },
  {
    label: "HR & Payroll",
    items: [
      { label: "Attendance", path: "/attendance", icon: Fingerprint, departments: ["admin", "finance"] },
      { label: "Payroll", path: "/payroll", icon: Wallet, departments: ["admin", "finance"] },
      { label: "Bonus", path: "/bonus", icon: Gift, departments: ["admin", "finance"] },
      { label: "Leave", path: "/leave", icon: CalendarOff, departments: ["admin", "finance"] },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Announcements", path: "/announcements", icon: Megaphone }, // all
      { label: "Feedback", path: "/feedback", icon: MessageSquareWarning }, // all
      { label: "Machine Issues", path: "/machine-issues", icon: Wrench }, // all
      { label: "Notifications", path: "/notification-settings", icon: BellRing, departments: ["admin"] },
      { label: "AI Advisor", path: "/advisor", icon: Sparkles, departments: ["admin", "finance"] },
      { label: "Ask Jarvis", path: "/assistant", icon: Bot }, // all
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", path: "/users", icon: UserRound, departments: ["admin"] },
      { label: "Data Import/Export", path: "/data-io", icon: Database, departments: ["admin"] },
    ],
  },
];

export const allNavItems: NavItem[] = navSections.flatMap((s) => s.items);

// A department may see an item when the item is unrestricted, the user is
// admin, or the item explicitly lists the department. Unknown/absent
// department (e.g. a legacy user carrying only a raw role) sees only the
// unrestricted items — fail closed.
const FLOOR_DEPARTMENTS: Department[] = ["preparatory", "weaving", "packing"];

export function canAccess(item: NavItem, department: string | undefined | null): boolean {
  if (!item.departments) return true;
  if (department === "admin") return true;
  // Legacy users carrying the raw backend role `production` (no
  // department assigned yet) span the whole floor — show the union of
  // the three floor departments until an admin assigns one.
  if (department === "production") {
    return item.departments.some((d) => FLOOR_DEPARTMENTS.includes(d));
  }
  return !!department && item.departments.includes(department as Department);
}

// Existing users created before `department` existed carry only a raw
// `role`. Fall back so they aren't locked out — most importantly the
// owner (role 'admin') must keep full access.
export function effectiveDepartment(
  user: { role?: string; department?: string | null } | null | undefined
): string | undefined {
  if (!user) return undefined;
  if (user.department) return user.department;
  if (user.role === "admin") return "admin";
  if (user.role === "accounts") return "finance";
  if (user.role === "production") return "production"; // union of floor depts (see canAccess)
  return undefined; // legacy stores/sales → unrestricted items until reassigned
}

export function visibleSections(department: string | undefined | null): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccess(item, department)),
    }))
    .filter((section) => section.items.length > 0);
}

/** Path → allowed check, for route guarding. Matches the most specific
 *  nav item that is a prefix of the path, so detail pages (e.g.
 *  /orders/123) inherit their section's ("/orders") access. Paths with no
 *  matching nav item are allowed (e.g. "/" dashboard). */
export function canAccessPath(path: string, department: string | undefined | null): boolean {
  if (department === "admin") return true;
  const match = allNavItems
    .filter((i) => i.path !== "/" && (path === i.path || path.startsWith(i.path + "/")))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match ? canAccess(match, department) : true;
}
