import { it, expect } from "vitest";
import { recostMessage } from "./api";

const r = (before: number | null, after: number) => ({
  costing: { materialCost: after - 1.5, conversionCost: 1.5, totalCost: after },
  before: before == null ? null : { materialCost: before - 1.5, conversionCost: 1.5, totalCost: before },
});

it("says what the recalculation changed", () => {
  expect(recostMessage(r(2.282, 2.342))).toBe("Cost recalculated: ₹2.28 → ₹2.34 a metre");
  expect(recostMessage(r(2.282, 2.2821))).toBe("Cost unchanged at ₹2.28 a metre");
  expect(recostMessage(r(null, 3.1))).toBe("Cost recalculated: ₹3.10 a metre");
});
