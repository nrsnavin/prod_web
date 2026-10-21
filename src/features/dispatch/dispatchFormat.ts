import { ChipTone } from "@/components/ui/StatusChip";
import { Urgency } from "./types";

// How urgent each slot looks: the sooner, the louder.
export const URGENCY_TONE: Record<Urgency, ChipTone> = {
  today_morning: "danger",
  today_evening: "warning",
  today: "info",
  tomorrow: "neutral",
};

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * When it has to leave, said the way people say it: "by 1:00 PM today",
 * "by end of day tomorrow". Read from the deadline, not the slot name, so
 * "tomorrow" chosen yesterday reads as today.
 */
export function dueText(dueAt: string, now: Date = new Date()): string {
  const due = new Date(dueAt);
  const days = Math.round((dayStart(due) - dayStart(now)) / 86_400_000);
  const day = days === 0 ? "today" : days === 1 ? "tomorrow" : days === -1 ? "yesterday"
    : due.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const endOfDay = due.getHours() === 23 && due.getMinutes() === 59;
  const time = due.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return endOfDay ? `by end of day ${day}` : `by ${time} ${day}`;
}

/** "2h 10m", "45m", "3d 2h" — a span, for late-by and waiting-for. */
export function span(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}
