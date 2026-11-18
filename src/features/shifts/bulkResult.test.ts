import { describe, expect, it } from "vitest";
import { bulkResultMessage } from "./sheet";

// ══════════════════════════════════════════════════════════════════
//  WHAT A BATCH OF PRODUCTION FIGURES CAME TO
//
//  The server takes the rows it can and hands back the rest with why:
//  the shift was already closed, the plan is finalised, the loom was
//  loading. The screen said "N sent" and closed, so the rows left out
//  were never mentioned.
// ══════════════════════════════════════════════════════════════════

describe("the result of a batch", () => {
  it("is just the count when everything went", () => {
    expect(bulkResultMessage({ success: true, saved: 3, skipped: [] })).toEqual({ message: "3 shifts sent for verification", partial: false });
    expect(bulkResultMessage({ success: true, saved: 1 })).toEqual({ message: "1 shift sent for verification", partial: false });
  });

  it("says what was left out and why, the same reason once", () => {
    const res = bulkResultMessage({
      success: true, saved: 2,
      skipped: [
        { id: "a", reason: "Already closed" },
        { id: "b", reason: "Already closed" },
        { id: "c", reason: "Shift is finalised — an admin must reopen it first" },
      ],
    });
    expect(res.partial).toBe(true);
    expect(res.message).toBe("2 shifts sent for verification. 3 not taken: Already closed (2); Shift is finalised — an admin must reopen it first.");
  });

  it("nothing taken at all is still said plainly", () => {
    expect(bulkResultMessage({ success: true, saved: 0, skipped: [{ id: "a", reason: "Machine was loading" }] }).message)
      .toBe("0 shifts sent for verification. 1 not taken: Machine was loading.");
  });
});
