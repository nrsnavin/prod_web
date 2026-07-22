import { describe, it, expect } from "vitest";
import { requirementRequired, requirementAvailable } from "./OrderDetailPage";
import { RawMaterialRequirement } from "./types";

describe("raw material requirement mapping", () => {
  // The order-detail endpoint returns rows shaped like this.
  const fromApi: RawMaterialRequirement = {
    rawMaterial: "abc123",
    name: "Nylon 40D",
    unit: "kg",
    requiredWeight: 30,
    inStock: 12,
    stockSufficient: false,
  };

  it("reads requiredWeight from the order-detail payload (regression: showed 0)", () => {
    expect(requirementRequired(fromApi)).toBe(30);
  });

  it("reads inStock from the order-detail payload (regression: showed —)", () => {
    expect(requirementAvailable(fromApi)).toBe(12);
  });

  it("falls back to legacy required/available names", () => {
    expect(requirementRequired({ required: 8 })).toBe(8);
    expect(requirementRequired({ quantity: 5 })).toBe(5);
    expect(requirementAvailable({ available: 3 })).toBe(3);
    expect(requirementAvailable({ stock: 2 })).toBe(2);
  });

  it("defaults required to 0 and available to null when nothing is present", () => {
    expect(requirementRequired({})).toBe(0);
    expect(requirementAvailable({})).toBeNull();
  });
});
