import { describe, expect, it } from "vitest";
import { expectedPerHead, perHeadText, runMinutes } from "./productionRate";

describe("minutes in a run time", () => {
  it("reads the ways a run time is typed", () => {
    expect(runMinutes("7:30")).toBe(450);
    expect(runMinutes("7.30")).toBe(450);
    expect(runMinutes("730")).toBe(450);
    expect(runMinutes("07:30:00")).toBe(450);
    expect(runMinutes("0:30:30")).toBeCloseTo(30.5);
    expect(runMinutes("12:00")).toBe(720);
  });
  it("gives nothing for what it cannot read", () => {
    expect(runMinutes("")).toBeNull();
    expect(runMinutes("7h")).toBeNull();
    expect(runMinutes("7:75")).toBeNull();
  });
});

describe("metres a head at 30 cm a minute", () => {
  it("is the run time times the rate, to a tenth", () => {
    expect(expectedPerHead("7:30")).toBe(135);
    expect(expectedPerHead("12:00")).toBe(216);
    expect(expectedPerHead("0:30:30")).toBe(9.15);
    expect(expectedPerHead("7:30", 40)).toBe(180);
    expect(expectedPerHead("x")).toBeNull();
  });
  it("as the field shows it", () => {
    expect(perHeadText("7:30")).toBe("135");
    expect(perHeadText("1:01")).toBe("18.3");
    expect(perHeadText("")).toBe("");
  });
});
