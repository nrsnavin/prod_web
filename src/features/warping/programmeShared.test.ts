import { describe, it, expect } from "vitest";
import { elasticNames } from "./programmeShared";

describe("elasticNames", () => {
  it("returns populated elastic names", () => {
    expect(
      elasticNames([
        { elastic: { _id: "e1", name: "E-100" }, quantity: 10 },
        { elastic: { _id: "e2", name: "E-200" }, quantity: 20 },
      ])
    ).toEqual(["E-100", "E-200"]);
  });

  it("drops unpopulated placeholders (regression: column showed —)", () => {
    // Before the list endpoints populated `elastic`, lines carried a bare
    // id string, which elasticLineName renders as an em dash.
    expect(elasticNames([{ elastic: "rawid", quantity: 10 }])).toEqual([]);
    expect(elasticNames([{ elastic: null, quantity: 10 }])).toEqual([]);
  });

  it("handles missing/empty input", () => {
    expect(elasticNames(undefined)).toEqual([]);
    expect(elasticNames([])).toEqual([]);
  });
});
