import {
  LayoutDashboard,
  TrendingUp,
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
  LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Roles allowed to see this item; undefined = all authenticated users */
  roles?: string[];
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
      { label: "Dashboard", path: "/", icon: LayoutDashboard },
      { label: "Analytics", path: "/analytics", icon: TrendingUp },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Orders", path: "/orders", icon: ShoppingCart },
      { label: "Job Orders", path: "/jobs", icon: ClipboardList },
      { label: "Delivery Challans", path: "/delivery-challans", icon: Truck },
    ],
  },
  {
    label: "Production",
    items: [
      { label: "Warping", path: "/warping", icon: Layers },
      { label: "Covering", path: "/covering", icon: Disc3 },
      { label: "Packing", path: "/packing", icon: Package },
      { label: "Shift Plans", path: "/shift-plans", icon: CalendarClock },
      { label: "Shift Verification", path: "/shift-verification", icon: ShieldCheck },
      { label: "Production View", path: "/production", icon: Factory },
      { label: "Wastage", path: "/wastage", icon: Trash2 },
    ],
  },
  {
    label: "Masters",
    items: [
      { label: "Customers", path: "/customers", icon: Users },
      { label: "Suppliers", path: "/suppliers", icon: Building2 },
      { label: "Purchase Orders", path: "/purchase-orders", icon: FileText },
      { label: "Raw Materials", path: "/materials", icon: Boxes },
      { label: "Elastic Products", path: "/elastics", icon: Cable },
      { label: "Machines", path: "/machines", icon: Cog },
      { label: "Employees", path: "/employees", icon: UserRound },
    ],
  },
  {
    label: "HR & Payroll",
    items: [
      { label: "Attendance", path: "/attendance", icon: Fingerprint },
      { label: "Payroll", path: "/payroll", icon: Wallet },
      { label: "Bonus", path: "/bonus", icon: Gift },
      { label: "Leave", path: "/leave", icon: CalendarOff },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Announcements", path: "/announcements", icon: Megaphone },
      { label: "Feedback", path: "/feedback", icon: MessageSquareWarning },
      { label: "Machine Issues", path: "/machine-issues", icon: Wrench },
      { label: "Notifications", path: "/notification-settings", icon: BellRing },
      { label: "AI Advisor", path: "/advisor", icon: Sparkles },
    ],
  },
  {
    label: "Utilities",
    items: [{ label: "Data Import/Export", path: "/data-io", icon: Database }],
  },
];

export const allNavItems: NavItem[] = navSections.flatMap((s) => s.items);

export function visibleSections(role: string | undefined): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.roles || (role !== undefined && item.roles.includes(role))
      ),
    }))
    .filter((section) => section.items.length > 0);
}
