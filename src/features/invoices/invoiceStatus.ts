import type { ChipTone } from "@/components/ui/StatusChip";
import type { EinvoiceStatus, InvoiceStatus } from "./types";

const DAY = 86_400_000;

export const invoiceStatusTone: Record<InvoiceStatus, ChipTone> = {
  issued: "success",
  // An outcome, not a fault: red is kept for what needs attention.
  cancelled: "neutral",
};

export const einvoiceTone: Record<EinvoiceStatus, ChipTone> = {
  pending: "warning",
  registered: "success",
  cancelled: "neutral",
};

export const einvoiceLabel: Record<EinvoiceStatus, string> = {
  pending: "IRN pending",
  registered: "IRN registered",
  cancelled: "IRN cancelled",
};

/** What is still owed on an issued invoice, as the receivables reckon it. */
export const owed = (i: {
  status: InvoiceStatus;
  totals?: { grand?: number };
  paidAmount?: number;
  creditedAmount?: number;
  debitedAmount?: number;
}) => (i.status !== "issued" ? 0 : Math.max(0, (i.totals?.grand ?? 0) + (i.debitedAmount ?? 0) - (i.paidAmount ?? 0) - (i.creditedAmount ?? 0)));

/** Whole days past due; 0 or less while it is not yet due. */
export const daysOverdue = (i: { dueDate?: string | null; invoiceDate: string }, now = new Date()) =>
  Math.floor((now.getTime() - new Date(i.dueDate || i.invoiceDate).getTime()) / DAY);
