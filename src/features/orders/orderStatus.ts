import { ChipTone } from "@/components/ui/StatusChip";
import { OrderFilter, OrderStatus } from "./types";

// Colour carries meaning: work in hand is indigo (info), waiting is
// neutral, an outcome is green, and amber/red are kept for what needs
// someone's attention, so they still stand out when they appear.
export const orderStatusTone: Record<OrderStatus, ChipTone> = {
  Open: "neutral",
  Approved: "neutral",
  InProgress: "info",
  Completed: "success",
  Cancelled: "neutral",
};

export const orderStatusLabel: Record<OrderStatus, string> = {
  Open: "Open",
  Approved: "Approved",
  InProgress: "In production",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

// Label for a list filter, which additionally covers "All".
export const orderFilterLabel: Record<OrderFilter, string> = {
  All: "All",
  ...orderStatusLabel,
};
