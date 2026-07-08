import { ChipTone, StatusChip } from "@/components/ui/StatusChip";
import { ElasticOrderedLine, ProgrammeStatus } from "./types";

export const programmeTone: Record<ProgrammeStatus, ChipTone> = {
  open: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "neutral",
};

export function ProgrammeChip({ status }: { status: ProgrammeStatus }) {
  return <StatusChip tone={programmeTone[status]}>{status.replace("_", " ")}</StatusChip>;
}

export function elasticLineName(line: ElasticOrderedLine): string {
  return typeof line.elastic === "object" && line.elastic ? line.elastic.name : "—";
}

export function ElasticLines({ lines }: { lines?: ElasticOrderedLine[] }) {
  if (!lines?.length) return <span className="text-ink-400">—</span>;
  return (
    <ul className="divide-y divide-ink-100">
      {lines.map((l, i) => (
        <li key={i} className="flex justify-between py-2 text-sm">
          <span className="font-medium">{elasticLineName(l)}</span>
          <span className="tabular-nums text-ink-600">{l.quantity.toLocaleString()} m</span>
        </li>
      ))}
    </ul>
  );
}
