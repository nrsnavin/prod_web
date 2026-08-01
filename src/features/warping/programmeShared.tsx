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

// Resolved elastic names for a programme's lines, dropping unpopulated
// placeholders — used by the list pages' Elastics column.
export function elasticNames(lines?: ElasticOrderedLine[]): string[] {
  return (lines ?? [])
    .map((l) => elasticLineName(l))
    .filter((n) => n && n !== "—");
}

export function ElasticLines({ lines }: { lines?: ElasticOrderedLine[] }) {
  if (!lines?.length) return <span className="text-ink-400">—</span>;
  return (
    <ul className="divide-y divide-ink-100">
      {lines.map((l, i) => (
        <li key={i} className="flex justify-between py-2 text-sm">
          <span className="font-medium">{elasticLineName(l)}</span>
          <span className="tabular-nums text-ink-600">{l.quantity.toLocaleString("en-IN")} m</span>
        </li>
      ))}
    </ul>
  );
}

// ── Tapes on a programme ────────────────────────────────────────────────
// A plan often runs one build several times over. Printed as a flat list
// of beams, the warper has no way to see where one tape ends and the next
// begins — which is the whole point of numbering them.

export interface TapeGroup<B> {
  /** Null for beams that belong to no tape (added by hand, or pre-tapes). */
  tapeNo: number | null;
  beams: B[];
}

/**
 * Group a plan's beams by tape, preserving their order.
 *
 * Returns a single untitled group when NO beam carries a tape, so an old
 * plan and a hand-built one print exactly as they did before rather than
 * growing a heading that says nothing.
 */
export function groupBeamsByTape<B extends { tapeNo?: number | null }>(
  beams: B[]
): TapeGroup<B>[] {
  if (!beams.some((b) => b.tapeNo != null)) {
    return beams.length ? [{ tapeNo: null, beams }] : [];
  }
  const groups: TapeGroup<B>[] = [];
  for (const beam of beams) {
    const tapeNo = beam.tapeNo ?? null;
    const last = groups[groups.length - 1];
    // Consecutive beams of one tape stay together; a tape that reappears
    // later opens a new group rather than jumping backwards, because the
    // sheet is read in the order the beams are built.
    if (last && last.tapeNo === tapeNo) last.beams.push(beam);
    else groups.push({ tapeNo, beams: [beam] });
  }
  return groups;
}

/** The elastic a beam warps, as it should read on paper. */
export function beamElasticName(beam: {
  elastic?: { _id: string; name: string } | string | null;
}): string {
  const e = beam.elastic;
  return e && typeof e === "object" ? e.name : "";
}
