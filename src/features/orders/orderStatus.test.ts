import { describe, it, expect } from "vitest";
import { ORDER_FILTERS, ORDER_STATUSES } from "./types";
import { orderFilterLabel } from "./orderStatus";

describe("order list filters", () => {
  it("offers 'All' as the first (default) filter", () => {
    expect(ORDER_FILTERS[0]).toBe("All");
  });

  it("includes every order status after All", () => {
    expect(ORDER_FILTERS).toEqual(["All", ...ORDER_STATUSES]);
  });

  it("has a label for every filter, including All", () => {
    for (const f of ORDER_FILTERS) {
      expect(orderFilterLabel[f]).toBeTruthy();
    }
    expect(orderFilterLabel.All).toBe("All");
  });
});
