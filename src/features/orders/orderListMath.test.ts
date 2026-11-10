import { describe, it, expect } from "vitest";
import { daysToSupply, isLate } from "./OrderListPage";
import type { OrderListItem } from "./types";

// The order book's countdown: days to the supply date, and "late" only
// for an order still live whose date has passed.

const now = new Date(2026, 10, 10, 15, 30); // 10 Nov 2026, afternoon
const order = (over: Partial<OrderListItem>): OrderListItem => ({ _id: "o", orderNo: 1, status: "InProgress", ...over });

describe("days to the supply date", () => {
  it("counts whole calendar days, whatever the hour", () => {
    expect(daysToSupply(new Date(2026, 10, 12, 0, 5).toISOString(), now)).toBe(2);
    expect(daysToSupply(new Date(2026, 10, 10, 23, 0).toISOString(), now)).toBe(0);
    expect(daysToSupply(new Date(2026, 10, 7).toISOString(), now)).toBe(-3);
  });
});

describe("late", () => {
  it("is a live order past its date, never a finished or cancelled one", () => {
    const past = new Date(2026, 10, 8).toISOString();
    expect(isLate(order({ supplyDate: past }), now)).toBe(true);
    expect(isLate(order({ supplyDate: past, status: "Completed" }), now)).toBe(false);
    expect(isLate(order({ supplyDate: past, status: "Cancelled" }), now)).toBe(false);
    expect(isLate(order({ supplyDate: new Date(2026, 10, 10).toISOString() }), now)).toBe(false);
    expect(isLate(order({}), now)).toBe(false);
  });
});
