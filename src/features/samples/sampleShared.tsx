import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { SampleStatus } from "./types";

// One mapping, used by the list, the detail header and the log, so a
// sample never reads "completed" in one place and "Completed" in another.

export const STATUS_LABEL: Record<SampleStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
  closed: "Closed",
};

// Completed and closed are BOTH ends of the road, but they are not the
// same end: one produced a sample the customer accepted, the other
// stopped. Colour says which without anyone reading the word.
const STATUS_TONE: Record<SampleStatus, ChipTone> = {
  open: "info",
  in_progress: "warning",
  completed: "success",
  closed: "neutral",
};

export function SampleStatusChip({ status }: { status: SampleStatus }) {
  return <StatusChip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusChip>;
}

export const TERMINAL: SampleStatus[] = ["completed", "closed"];
export const isTerminal = (s: SampleStatus) => TERMINAL.includes(s);

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const formatQty = (n: number) =>
  (Math.round(n * 100) / 100).toLocaleString("en-IN");
