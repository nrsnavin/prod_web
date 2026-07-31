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
  // preparatory → weaving is offered, but the server refuses it with
  // WEAVING_NOT_READY unless the job's warping AND covering are both
  // completed. Offering it is the point: the button is where the user
  // finds out what is still open.
  preparatory: "weaving",
  weaving: "finishing",
  finishing: "checking",
  checking: "packing",
  packing: "completed",
};
