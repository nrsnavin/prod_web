import { Truck } from "lucide-react";
import { StatusChip } from "@/components/ui/StatusChip";

// A job set to "outsource" is being made by a vendor, not on this floor.
// The Shifts screens all show a job number, and without this the shift
// reads as ordinary in-house work — so an operator or verifier has no way
// to tell that no machine here is producing it.
//
// Deliberately renders NOTHING for in-house work: every job would
// otherwise carry a badge and the exceptional case would stop standing
// out. Wording matches the job MRP page ("Outsourced — vendor").

export function outsourcedLabel(vendor?: string) {
  return `Outsourced${vendor ? ` — ${vendor}` : ""}`;
}

export function isOutsourced(mode?: string) {
  return mode === "outsource";
}

/** Full chip — for cards and headers with room. */
export function OutsourcedTag({
  productionMode,
  outsourceVendor,
}: {
  productionMode?: string;
  outsourceVendor?: string;
}) {
  if (!isOutsourced(productionMode)) return null;
  return (
    <StatusChip tone="warning">
      <span className="inline-flex items-center gap-1">
        <Truck className="h-3 w-3" />
        {outsourcedLabel(outsourceVendor)}
      </span>
    </StatusChip>
  );
}

/** Compact inline marker — for a table cell already showing "J-42". */
export function OutsourcedMark({
  productionMode,
  outsourceVendor,
}: {
  productionMode?: string;
  outsourceVendor?: string;
}) {
  if (!isOutsourced(productionMode)) return null;
  return (
    <span
      className="ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-status-warning/10 text-status-warning"
      title={outsourcedLabel(outsourceVendor)}
    >
      <Truck className="h-2.5 w-2.5" />
      Outsourced
    </span>
  );
}
