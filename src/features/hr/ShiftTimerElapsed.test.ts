import { it, expect } from "vitest";
import { elapsed } from "./ShiftTimerPanel";

// Back from a break, the clock shows the shift's time so far — the
// earlier stint plus this one — not a timer restarted at zero.
it("adds the minutes from earlier stints to the running one", () => {
  const now = Date.parse("2026-10-15T15:00:00Z");
  expect(elapsed("2026-10-15T14:30:00Z", now)).toBe("00:30:00");
  expect(elapsed("2026-10-15T14:30:00Z", now, 240)).toBe("04:30:00");
});
