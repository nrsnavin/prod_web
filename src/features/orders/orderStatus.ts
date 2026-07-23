import { ChipTone } from "@/components/ui/StatusChip";
import { OrderFilter, OrderStatus } from "./types";

export const orderStatusTone: Record<OrderStatus, ChipTone> = {
  Open: "info",
  Approved: "warning",
  InProgress: "warning",
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
