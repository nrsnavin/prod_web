import type { LeaveApplication, MyLeave } from "./types";

// The words a worker sees for their leave, in one place: the Leave
// screen, the Home card and the Pay screen all say the same thing.

export const SHIFT_OPTIONS: { value: LeaveApplication["shift"]; label: string }[] = [
  { value: "BOTH", label: "Whole day" },
  { value: "DAY", label: "Day shift" },
  { value: "NIGHT", label: "Night shift" },
];

export const TYPE_OPTIONS: { value: LeaveApplication["leaveType"]; label: string }[] = [
  { value: "casual", label: "Casual" },
  { value: "sick", label: "Sick" },
  { value: "unpaid", label: "Unpaid" },
];

export const leaveShiftLabel = (s: string) => SHIFT_OPTIONS.find((o) => o.value === s)?.label ?? s;
export const leaveTypeLabel = (t: string) => TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;

export const leaveStatusLabel = (s: string) =>
  s === "approved" ? "Approved" : s === "rejected" ? "Not approved" : "Waiting for approval";
export const leaveTone = (s: string): "success" | "danger" | "warning" =>
  s === "approved" ? "success" : s === "rejected" ? "danger" : "warning";

/** YYYY-MM-DD in the phone's own time zone (not UTC, which is a day off at night). */
export function localISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return localISO(new Date(y, m - 1, d + n));
};

/** Every date from `from` to `to`, both included. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Requests from today on, soonest first; and the rest, newest first. */
export function splitLeaves(leaves: MyLeave[], today: string) {
  const upcoming = leaves.filter((l) => l.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const earlier = leaves.filter((l) => l.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, earlier };
}

export const MAX_LEAVE_DAYS = 14;
