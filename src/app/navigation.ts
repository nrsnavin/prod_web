import {
  LayoutDashboard,
  TrendingUp,
  FileBarChart,
  IndianRupee,
  ShoppingCart,
  ClipboardList,
  Truck,
  FlaskConical,
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
  ClipboardCheck,
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
  SlidersHorizontal,
  LucideIcon,
} from "lucide-react";

// Departments drive who sees what. `admin` sees everything; the four
// shop-floor departments each see a focused set. Keep this list in sync
// with utils/roles.js on the backend.
// Preparatory + weaving were merged into a single "production" department
// (they always shared the production role). Packing stays separate.
export const DEPARTMENTS = ["admin", "production", "packing", "finance"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  production: "Production (Warping, Weaving & Covering)",
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
      { label: "Analytics", path: "/analytics", icon: TrendingUp, departments: ["admin", "production"] },
      { label: "Reports", path: "/reports", icon: FileBarChart, departments: ["admin", "finance"] },
      // Margin is its own permission: opening an order and seeing the
      // profit on it are different things. Mirrors /order-pnl in
      // utils/features.js on the backend.
      { label: "Order P&L", path: "/order-pnl", icon: IndianRupee, departments: ["admin", "finance"] },
      { label: "Audit Trail", path: "/audit", icon: Fingerprint, departments: ["admin"] },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Orders", path: "/orders", icon: ShoppingCart, departments: ["admin", "finance"] },
      { label: "Job Orders", path: "/jobs", icon: ClipboardList, departments: ["admin", "production", "packing"] },
      { label: "Delivery Challans", path: "/delivery-challans", icon: Truck, departments: ["admin", "finance"] },
      // Raised by sales, worked by production — both write to the log,
      // so both departments carry it. Mirrors /samples in utils/features.js.
      { label: "Sample Requests", path: "/samples", icon: FlaskConical, departments: ["admin", "finance", "production"] },
    ],
  },
  {
    label: "Production",
    items: [
      { label: "Auto Planner", path: "/planner", icon: Wand2, departments: ["admin", "production"] },
      { label: "Warping", path: "/warping", icon: Layers, departments: ["admin", "production"] },
      { label: "Covering", path: "/covering", icon: Disc3, departments: ["admin", "production"] },
      { label: "Packing", path: "/packing", icon: Package, departments: ["admin", "packing"] },
      { label: "Quality Control", path: "/qc", icon: ScanLine, departments: ["admin", "packing"] },
      { label: "Shift Plans", path: "/shift-plans", icon: CalendarClock, departments: ["admin", "production"] },
      { label: "Shift Verification", path: "/shift-verification", icon: ShieldCheck, departments: ["admin", "production"] },
      { label: "Production View", path: "/production", icon: Factory, departments: ["admin", "production"] },
      { label: "Wastage", path: "/wastage", icon: Trash2, departments: ["admin", "production"] },
    ],
  },
  {
    label: "Masters",
    items: [
      { label: "Customers", path: "/customers", icon: Users, departments: ["admin", "finance"] },
      { label: "Suppliers", path: "/suppliers", icon: Building2, departments: ["admin", "finance"] },
      { label: "Purchase Orders", path: "/purchase-orders", icon: FileText, departments: ["admin", "finance"] },
      { label: "Raw Materials", path: "/materials", icon: Boxes, departments: ["admin", "finance"] },
      // A count is a statement about raw material stock, so it sits
      // beside it rather than under Reports — the people who run one
      // are already on this screen.
      { label: "Stock Counts", path: "/stock-counts", icon: ClipboardCheck, departments: ["admin", "finance"] },
      { label: "Elastic Products", path: "/elastics", icon: Cable, departments: ["admin", "finance"] },
      { label: "Elastic Groups", path: "/elastic-groups", icon: Layers, departments: ["admin"] },
      { label: "Machines", path: "/machines", icon: Cog, departments: ["admin", "production"] },
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
      // Settings is all-access: everyone can rearrange their own sidebar;
      // the document/branding tab inside is admin-gated by the backend.
      { label: "Settings", path: "/settings", icon: SlidersHorizontal },
    ],
  },
];

// Sidebar items the user must never be able to hide (they'd lose their way
// back). Cosmetic hiding only — routes stay reachable regardless.
export const UNHIDEABLE_PATHS = ["/", "/settings"];

export const allNavItems: NavItem[] = navSections.flatMap((s) => s.items);

// A department may see an item when the item is unrestricted, the user is
// admin, or the item explicitly lists the department. Unknown/absent
// department (e.g. a legacy user carrying only a raw role) sees only the
// unrestricted items — fail closed.
// Legacy departments (pre-merge) alias to the merged "production" dept.
const LEGACY_DEPT_ALIAS: Record<string, string> = { preparatory: "production", weaving: "production" };
function normDept(d: string | null | undefined): string | undefined {
  if (!d) return undefined;
  return LEGACY_DEPT_ALIAS[d] ?? d;
}

// Access context: the current user (or, for legacy call paths, a bare
// department string). A user's explicit `features` list is authoritative
// when present; otherwise we fall back to the department defaults.
export type AccessCtx =
  | { role?: string; department?: string | null; features?: string[] | null }
  | string
  | null
  | undefined;

function ctxFeatures(ctx: AccessCtx): string[] | undefined {
  if (ctx && typeof ctx === "object" && Array.isArray(ctx.features)) return ctx.features;
  return undefined;
}

export function canAccess(item: NavItem, ctx: AccessCtx): boolean {
  if (!item.departments) return true; // unrestricted — always visible

  // Custom per-user features win when present.
  const features = ctxFeatures(ctx);
  if (features) return features.includes(item.path);

  // Legacy fallback: department-based.
  const department = typeof ctx === "string" ? normDept(ctx) : effectiveDepartment(ctx);
  if (department === "admin") return true;
  return !!department && item.departments.includes(department as Department);
}

// Existing users created before `department` existed carry only a raw
// `role`. Fall back so they aren't locked out — most importantly the
// owner (role 'admin') must keep full access.
export function effectiveDepartment(
  user: { role?: string; department?: string | null } | null | undefined
): string | undefined {
  if (!user) return undefined;
  if (user.department) return normDept(user.department);
  if (user.role === "admin") return "admin";
  if (user.role === "accounts") return "finance";
  if (user.role === "production") return "production";
  return undefined; // legacy stores/sales → unrestricted items until reassigned
}

export function visibleSections(ctx: AccessCtx): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccess(item, ctx)),
    }))
    .filter((section) => section.items.length > 0);
}

// Apply the user's personal sidebar prefs (hidden items + per-section
// order) on top of the department-filtered sections. Unknown/newly-added
// items that aren't in a saved order fall to the end in their original
// order, so shipping a new nav item never disappears.
export interface NavPrefs {
  navHidden: string[];
  navOrder: Record<string, string[]>;
}

export function applyNavPrefs(sections: NavSection[], prefs: NavPrefs): NavSection[] {
  const hidden = new Set(prefs.navHidden.filter((p) => !UNHIDEABLE_PATHS.includes(p)));
  return sections
    .map((section) => {
      const order = prefs.navOrder[section.label];
      let items = section.items;
      if (order && order.length) {
        const idx = (p: string) => {
          const i = order.indexOf(p);
          return i === -1 ? Number.MAX_SAFE_INTEGER : i;
        };
        items = [...items].sort((a, b) => idx(a.path) - idx(b.path));
      }
      items = items.filter((i) => !hidden.has(i.path));
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);
}

/** Path → allowed check, for route guarding. Matches the most specific
 *  nav item that is a prefix of the path, so detail pages (e.g.
 *  /orders/123) inherit their section's ("/orders") access. Paths with no
 *  matching nav item are allowed (e.g. "/" dashboard). */
export function canAccessPath(path: string, ctx: AccessCtx): boolean {
  const match = allNavItems
    .filter((i) => i.path !== "/" && (path === i.path || path.startsWith(i.path + "/")))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match ? canAccess(match, ctx) : true;
}

// ── Feature catalog helpers (for the admin Users screen) ──────────────
// The nav item paths ARE the feature keys. The create/edit user form shows
// this grouped list as a checklist.
export interface FeatureOption {
  key: string; // the nav path, e.g. "/orders"
  label: string;
  /** true when every user can open it regardless of assigned features. */
  always: boolean;
}
export interface FeatureGroup {
  section: string;
  features: FeatureOption[];
}
export const FEATURE_GROUPS: FeatureGroup[] = navSections.map((s) => ({
  section: s.label,
  features: s.items.map((i) => ({ key: i.path, label: i.label, always: !i.departments })),
}));
export const ALL_FEATURE_KEYS: string[] = allNavItems.map((i) => i.path);

// Default feature set for a department — mirrors utils/features.js on the
// backend. Used to seed the checklist when an admin picks a department.
export function featuresForDepartment(department: string | undefined | null): string[] {
  return allNavItems
    .filter((i) => canAccess(i, department ?? undefined))
    .map((i) => i.path);
}
