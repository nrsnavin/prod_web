import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Cable,
  ClipboardList,
  FileText,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

// ══════════════════════════════════════════════════════════════════
//  ⌘K DOES THINGS, NOT ONLY FINDS THEM
//
//  "new order", "receipt from Sunrise", "go to J-4": the search box also
//  starts the common pieces of work, in the words people use for them.
//  Each action opens the same form its page's button opens, so there is
//  one way a thing is made, reached two ways.
// ══════════════════════════════════════════════════════════════════

export interface PaletteAction {
  label: string;
  /** Where the form lives; `?new=…` opens it on arrival. */
  path: string;
  icon: LucideIcon;
  /** What people type for it, besides its label. */
  words: string[];
}

export const ACTIONS: PaletteAction[] = [
  { label: "New order", path: "/orders?new=1", icon: ShoppingCart, words: ["create order", "add order", "order new"] },
  { label: "New delivery challan", path: "/delivery-challans?new=1", icon: Truck, words: ["new dc", "new challan", "dispatch goods"] },
  { label: "Add customer", path: "/customers?new=1", icon: Users, words: ["new customer", "create customer"] },
  { label: "New elastic", path: "/elastics?new=1", icon: Cable, words: ["add elastic", "create elastic"] },
  { label: "New quote", path: "/quotes/new", icon: FileText, words: ["new quotation", "create quote"] },
  { label: "New purchase order", path: "/purchase-orders/new", icon: ClipboardList, words: ["new po", "create po", "order yarn"] },
  { label: "Record receipt", path: "/accounts/vouchers?new=receipt", icon: ArrowDownLeft, words: ["new receipt", "money in", "customer paid"] },
  { label: "Record payment", path: "/accounts/vouchers?new=payment", icon: ArrowUpRight, words: ["new payment", "money out", "pay supplier"] },
  { label: "New supplier bill", path: "/accounts/bills?new=bill", icon: Receipt, words: ["new bill", "purchase bill", "enter bill"] },
  { label: "New expense", path: "/accounts/expenses?new=expense", icon: Wallet, words: ["add expense", "enter expense"] },
  { label: "Post a journal", path: "/accounts/vouchers?new=journal", icon: BookOpen, words: ["new journal", "journal entry"] },
];

/** The page an action's path belongs to, for the access check. */
export const actionPage = (a: PaletteAction) => a.path.split("?")[0];

/** Actions whose label or words take in what was typed. Nothing typed, nothing offered. */
export function matchActions(query: string, actions: PaletteAction[] = ACTIONS): PaletteAction[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (q.length < 2) return [];
  return actions.filter((a) => [a.label.toLowerCase(), ...a.words].some((w) => w.includes(q) || (q.length >= 4 && q.startsWith(w))));
}

export type Intent =
  /** "receipt from Sunrise", "record receipt sunrise" */
  | { kind: "receipt"; party: string }
  /** "pay Lakshmi Yarns", "payment to lakshmi" */
  | { kind: "payment"; party: string }
  /** "go to J-4", "open #4": the rest is searched as usual. */
  | { kind: "goto"; rest: string };

export function parseIntent(query: string): Intent | null {
  const q = query.trim().replace(/\s+/g, " ");
  const receipt = q.match(/^(?:record\s+)?(?:a\s+)?receipt\s+(?:from\s+)?(.{2,})$/i);
  if (receipt) return { kind: "receipt", party: receipt[1].trim() };
  const payment = q.match(/^(?:record\s+)?(?:a\s+)?(?:payment|pay)\s+(?:to\s+)?(.{2,})$/i);
  if (payment) return { kind: "payment", party: payment[1].trim() };
  const goto = q.match(/^(?:go\s*to|open|show)\s+(.+)$/i);
  if (goto) return { kind: "goto", rest: goto[1].trim() };
  return null;
}

/** Where a receipt or payment for a chosen party opens: its form, the party filled in. */
export const voucherFor = (kind: "receipt" | "payment", party: { id: string; name: string }) =>
  `/accounts/vouchers?${new URLSearchParams({ new: kind, party: party.id, partyName: party.name }).toString()}`;
