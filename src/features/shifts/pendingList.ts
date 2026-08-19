import { PendingShift } from "./types";

/**
 * The pending-verification list with one shift taken off it.
 *
 * Split out of the mutation because this is the part that can be wrong,
 * and it deserves testing without react-query's lifecycle behind it.
 *
 * It returns a NEW object: the mutation keeps the original as its
 * rollback snapshot, and mutating in place would leave nothing to roll
 * back to — a failed verification would restore the guess.
 */
export function withoutShift(
  pending: { count: number; shifts: PendingShift[] },
  shiftId: string
): { count: number; shifts: PendingShift[] } {
  const shifts = (pending.shifts ?? []).filter((s) => s._id !== shiftId);
  return {
    ...pending,
    shifts,
    // The badge has to move with the list. "3 pending" beside two rows
    // is the sort of disagreement that makes somebody reload the page
    // to find out which one is lying.
    count: shifts.length,
  };
}
