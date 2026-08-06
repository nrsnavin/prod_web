import { describe, it, expect } from "vitest";
import { marginLabel, marginTone, meters, rupee, rupeePrecise } from "./format";

// An order nobody has priced has an UNKNOWN margin. Rendering that as a
// number — 0%, or the -100% the arithmetic would give — puts a fake
// disaster at the top of a list sorted by worst margin, which is exactly
// where a real one needs to be visible.
describe("an unpriced order", () => {
  it("reads as not priced rather than as a loss", () => {
    expect(marginLabel(null)).toBe("Not priced");
    expect(marginTone(null)).toBe("neutral");
  });

  it("does not borrow the danger tone a real loss uses", () => {
    expect(marginTone(-12)).toBe("danger");
    expect(marginTone(null)).not.toBe("danger");
  });
});

describe("margin tone", () => {
  it("warns on a thin margin and passes a healthy one", () => {
    expect(marginTone(3)).toBe("warning");
    expect(marginTone(40)).toBe("success");
  });
});

describe("money", () => {
  it("rounds totals but keeps the paise on rates", () => {
    expect(rupee(16700.4)).toBe("₹16,700");
    expect(rupeePrecise(16.7)).toBe("₹16.70");
  });

  // "₹-8,010" reads as a typo before it reads as a loss.
  it("puts the minus sign outside the rupee symbol", () => {
    expect(rupee(-8010)).toBe("−₹8,010");
    expect(rupeePrecise(-16.7)).toBe("−₹16.70");
  });

  it("renders a missing figure as a dash, never as zero", () => {
    expect(rupee(null)).toBe("—");
    expect(rupeePrecise(undefined)).toBe("—");
    expect(meters(null)).toBe("—");
  });

  it("formats meters in the Indian grouping", () => {
    expect(meters(125000)).toBe("1,25,000 m");
  });
});
