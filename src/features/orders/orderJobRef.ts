import { OrderJobRef } from "./types";

// `get-orderDetail` populates `jobs.job` into the full JobOrder document,
// so `j.job` is an object (id lives at `j.job._id`), not a string. Reading
// `j.job` directly produced `/jobs/[object Object]` → "Invalid job ID".
//
// Their own module rather than OrderDetailPage's: OrderJobGlance needs them
// too, and importing them from the page would make the two files circular.
export function jobRefId(j: OrderJobRef): string | undefined {
  if (j.job && typeof j.job === "object") return j.job._id;
  if (typeof j.job === "string") return j.job;
  return j._id;
}

export function jobRefNo(j: OrderJobRef): number | undefined {
  if (j.no != null) return j.no;
  if (j.job && typeof j.job === "object") return j.job.jobOrderNo;
  return j.jobOrderNo;
}

export function jobRefStatus(j: OrderJobRef): string | undefined {
  if (j.job && typeof j.job === "object" && j.job.status) return j.job.status;
  return j.status;
}
