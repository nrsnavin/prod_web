import type { ChipTone } from "@/components/ui/StatusChip";
import type { EinvoiceStatus, InvoiceStatus } from "./types";

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
