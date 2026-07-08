import { ChipTone } from "@/components/ui/StatusChip";
import { JobStatus } from "./types";

export const jobStatusTone: Record<JobStatus, ChipTone> = {
  preparatory: "neutral",
  weaving: "info",
  finishing: "info",
  checking: "warning",
  packing: "warning",
  completed: "success",
  cancelled: "neutral",
};

export const nextJobStatus: Partial<Record<JobStatus, JobStatus>> = {
  weaving: "finishing",
  finishing: "checking",
  checking: "packing",
  packing: "completed",
};
