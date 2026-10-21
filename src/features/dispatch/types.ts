// ══════════════════════════════════════════════════════════════════
//  THE DISPATCH QUEUE — mirrors prod/models/DispatchItem.js and
//  prod/api/dispatch.js
// ══════════════════════════════════════════════════════════════════

export type Urgency = "today_morning" | "today_evening" | "today" | "tomorrow";
export type DispatchStatus = "awaiting_urgency" | "queued" | "dispatched" | "cancelled";

export const URGENCY_OPTIONS: Array<{ value: Urgency; label: string; hint: string }> = [
  { value: "today_morning", label: "Today morning", hint: "by 1 PM" },
  { value: "today_evening", label: "Today evening", hint: "by 7 PM" },
  { value: "today", label: "Today", hint: "by end of day" },
  { value: "tomorrow", label: "Tomorrow", hint: "by end of tomorrow" },
];

export interface DispatchItem {
  _id: string;
  kind: "job" | "sample";
  job?: string;
  order?: string;
  sample?: string;
  customerName: string;
  ref: string;
  title: string;
  quantity: number;
  orderNo: number | null;
  status: DispatchStatus;
  readyAt: string;
  urgency: Urgency | null;
  urgencyLabel: string | null;
  dueAt: string | null;
  urgencySetByName?: string;
  urgencySetAt?: string | null;
  dispatchedAt?: string | null;
  dispatchedByName?: string;
  dispatchNote?: string;
  /** Past its deadline and not yet gone. */
  late: boolean;
}

export interface DispatchQueue {
  now: string;
  counts?: { awaiting: number; queued: number; late: number };
  items: DispatchItem[];
}
