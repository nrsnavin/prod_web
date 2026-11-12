import { describe, expect, it } from "vitest";
import { completeSettings } from "./api";

// A settings record saved by an older server lacks the parts added since.
// The settings page once failed reading `shiftEndNudge.phones.length` on
// one; it now always gets every part.
describe("production settings from an older server", () => {
  it("get the reminder's phone list and the handover note when they are missing", () => {
    const old = { autoVerify: { enabled: true, tolerancePct: 12, minShifts: 8 }, shiftEndNudge: { enabled: false, minutesBefore: 45 } };
    const s = completeSettings(old as never);
    expect(s.autoVerify).toEqual({ enabled: true, tolerancePct: 12, minShifts: 8 });
    expect(s.shiftEndNudge).toEqual({ enabled: false, minutesBefore: 45, phones: [] });
    expect(s.shiftHandover).toEqual({ enabled: false, withinMinutes: 60, phones: [] });
  });

  it("keep everything that is there", () => {
    const full = {
      autoVerify: { enabled: false, tolerancePct: 10, minShifts: 8 },
      shiftEndNudge: { enabled: true, minutesBefore: 20, phones: ["+919876543210"] },
      shiftHandover: { enabled: true, withinMinutes: 90, phones: ["+919000000001"] },
    };
    expect(completeSettings(full)).toEqual(full);
  });

  it("stand even when nothing came back", () => {
    const s = completeSettings(undefined);
    expect(s.autoVerify.enabled).toBe(false);
    expect(s.shiftEndNudge.phones).toEqual([]);
    expect(s.shiftHandover?.phones).toEqual([]);
  });
});
