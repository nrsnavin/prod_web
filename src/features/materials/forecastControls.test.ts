import { describe, it, expect, vi, beforeEach } from "vitest";
import { httpClient } from "@/core/http/httpClient";
import { materialService } from "./api";

// ══════════════════════════════════════════════════════════════════
//  A CONTROL THAT CHANGES NO NUMBER IS WORSE THAN NO CONTROL
//
//  The forecast page used to offer 7 / 14 / 30 / 60-day "horizon" tabs,
//  and the server projected stock over that window. It does not any
//  more: the reorder point comes from the supplier's lead time, and
//  what a buyer chooses is how long an order should LAST.
//
//  When the page was rebuilt around that, the hook still sent
//  `horizonDays` — a parameter the server now ignores. The tabs
//  rendered, highlighted on click, refetched, and returned identical
//  figures every time. Nothing errored.
//
//  Same shape as the quotation reprice that answered 200 and changed
//  nothing. This pins the wire so it cannot come back.
// ══════════════════════════════════════════════════════════════════

describe("what the forecast request actually asks for", () => {
  beforeEach(() => vi.restoreAllMocks());

  const captureQuery = () => {
    const spy = vi.spyOn(httpClient, "get").mockResolvedValue({} as never);
    return {
      spy,
      query: () => spy.mock.calls[0]?.[1] as Record<string, unknown>,
      path: () => spy.mock.calls[0]?.[0] as string,
    };
  };

  it("sends coverDays, which is the thing the server reads", async () => {
    const c = captureQuery();
    await materialService.replenishmentForecast(45);

    expect(c.path()).toBe("/materials/replenishment-forecast");
    expect(c.query().coverDays).toBe(45);
  });

  it("does NOT send horizonDays, which the server ignores", async () => {
    const c = captureQuery();
    await materialService.replenishmentForecast(45);
    expect(c.query()).not.toHaveProperty("horizonDays");
  });

  it("carries the service level, so the picker is not decoration either", async () => {
    const c = captureQuery();
    await materialService.replenishmentForecast(30, 60, 98);
    expect(c.query().serviceLevel).toBe(98);
  });

  it("looks back far enough to estimate a spread", async () => {
    // Safety stock is driven by how much daily demand varies, and a
    // month of a mill's draws is too few days to measure that from.
    const c = captureQuery();
    await materialService.replenishmentForecast(30);
    expect(c.query().lookbackDays).toBe(60);
  });

  it("passes a changed cover through, rather than reusing one value", async () => {
    const spy = vi.spyOn(httpClient, "get").mockResolvedValue({} as never);
    await materialService.replenishmentForecast(15);
    await materialService.replenishmentForecast(60);

    const sent = spy.mock.calls.map((c) => (c[1] as Record<string, unknown>).coverDays);
    expect(sent).toEqual([15, 60]);
  });
});
