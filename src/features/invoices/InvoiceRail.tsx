import { ProgressRail, settle, type RailStep } from "@/components/ui/ProgressRail";
import { formatDate } from "@/core/format/date";
import { rupees } from "@/core/format/money";
import { owed } from "./invoiceStatus";
import type { Invoice } from "./types";

// ══════════════════════════════════════════════════════════════════
//  AN INVOICE, FROM ISSUE TO PAYMENT
//
//  Issued → checked → IRN registered → e-way bill → paid. "Checked" is
//  the portal's own test: nothing on the invoice it would refuse. The
//  e-way bill is skipped when the goods are worth ₹50,000 or less, the
//  limit under CGST Rule 138, unless one was made anyway.
// ══════════════════════════════════════════════════════════════════

/** Goods above this move with an e-way bill. */
const EWB_LIMIT = 50000;

export function invoiceSteps(inv: Invoice): RailStep[] {
  const registered = inv.einvoice?.status === "registered";
  const problems = inv.einvoiceProblems ?? [];
  const ewb = inv.ewaybill?.status === "generated" ? inv.ewaybill : null;
  const grand = inv.totals?.grand ?? 0;
  const due = owed(inv);
  const received = (inv.paidAmount ?? 0) + (inv.creditedAmount ?? 0);
  return settle([
    { key: "issued", label: "Issued", done: true, detail: formatDate(inv.invoiceDate) },
    {
      key: "checked",
      label: "Checked",
      done: registered || problems.length === 0,
      detail: registered || problems.length === 0 ? "Ready for the portal" : `${problems.length} thing${problems.length === 1 ? "" : "s"} to fix`,
    },
    {
      key: "irn",
      label: "IRN registered",
      done: registered,
      detail: registered && inv.einvoice.ackDate ? formatDate(inv.einvoice.ackDate) : undefined,
    },
    {
      key: "ewb",
      label: "E-way bill",
      done: !!ewb,
      skipped: grand <= EWB_LIMIT,
      detail: ewb ? ewb.number || "Made" : grand <= EWB_LIMIT ? "Not needed at this value" : `Needed over ${rupees(EWB_LIMIT)}`,
    },
    {
      key: "paid",
      label: "Paid",
      done: due < 1,
      detail: due < 1 ? "Paid in full" : received > 0 ? `${rupees(received)} in, ${rupees(due)} owed` : `${rupees(due)} owed`,
    },
  ]);
}

export function InvoiceRail({ inv }: { inv: Invoice }) {
  // A cancelled invoice has no road left to show.
  if (inv.status !== "issued") return null;
  return <ProgressRail label="Invoice progress" steps={invoiceSteps(inv)} className="mb-4" />;
}
