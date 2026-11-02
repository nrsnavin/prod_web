import type { ChipTone } from "@/components/ui/StatusChip";
import type { EinvoiceStatus, InvoiceStatus } from "./types";

export const invoiceStatusTone: Record<InvoiceStatus, ChipTone> = {
  issued: "success",
  cancelled: "danger",
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
