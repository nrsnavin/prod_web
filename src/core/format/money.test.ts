import { describe, it, expect } from "vitest";
import { rupees, rupeesPrecise, rupeesAuto, rupeesCompact, metres, quantity } from "./money";

describe("money and metres, written one way", () => {
  it("puts the sign before the rupee symbol", () => {
    expect(rupees(-8010)).toBe("−₹8,010");
    expect(rupeesPrecise(-16.7)).toBe("−₹16.70");
    expect(rupeesAuto(-12.5)).toBe("−₹12.5");
  });

  it("groups digits the Indian way", () => {
    expect(rupees(1234567)).toBe("₹12,34,567");
    expect(metres(140000)).toBe("1,40,000 m");
  });

  it("rounds totals, pads rates, keeps pay as it is", () => {
    expect(rupees(12400.6)).toBe("₹12,401");
    expect(rupeesPrecise(16.7)).toBe("₹16.70");
    expect(rupeesAuto(12400)).toBe("₹12,400");
    expect(rupeesAuto(12400.456)).toBe("₹12,400.46");
  });

  it("writes lakh and crore for tiles, and small figures in full", () => {
    expect(rupeesCompact(815000)).toBe("₹8.15 L");
    expect(rupeesCompact(12000000)).toBe("₹1.20 Cr");
    expect(rupeesCompact(45000)).toBe("₹45,000");
    expect(rupeesCompact(-192000)).toBe("−₹1.92 L");
  });

  it("shows a missing figure as a gap, not a zero", () => {
    for (const f of [rupees, rupeesPrecise, rupeesAuto, rupeesCompact, metres]) {
      expect(f(null)).toBe("—");
      expect(f(undefined)).toBe("—");
      expect(f(Number.NaN)).toBe("—");
    }
    expect(rupees(0)).toBe("₹0");
    expect(quantity(null)).toBe("—");
  });

  it("writes quantities with their unit", () => {
    expect(quantity(1212.5, "kg")).toBe("1,212.5 kg");
    expect(quantity(3)).toBe("3");
  });
});
