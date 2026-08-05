// Mirrors utils/productionLock.js on the server.
//
// Moving a job to `finishing` releases its machine — the cloth is off the
// loom — so production entry, corrections and the outsource toggle are all
// refused from that point on. The server is the enforcement; this exists
// so the UI stops OFFERING actions that would come back 409, and explains
// why instead of failing on click.
//
// Keep the list in step with the server's PRODUCTION_LOCKED_STATUSES.

export const PRODUCTION_LOCKED_STATUSES = [
  "finishing",
  "checking",
  "packing",
  "completed",
  "cancelled",
] as const;

export function isProductionLocked(status?: string | null): boolean {
  return !!status && (PRODUCTION_LOCKED_STATUSES as readonly string[]).includes(status);
}

/** Why the action is unavailable — used as a tooltip and helper text. */
export function productionLockReason(status?: string | null): string {
  return `Production closed — this job has moved to ${status}.`;
}
