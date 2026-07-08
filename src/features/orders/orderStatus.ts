import { ChipTone } from "@/components/ui/StatusChip";
import { OrderStatus } from "./types";

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
