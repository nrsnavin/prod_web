import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MonthReview } from "./MonthReview";

// The month in plain words, written when asked, beside the figures it came from.

const get = vi.fn(async () => ({
  month: "2026-10", by: "rules", points: ["Sales ₹1,80,000 — up 20% on September 2026, 40,000 m invoiced.", "Power: ₹70,000 against a usual ₹41,000."],
  figures: { label: "October 2026", previous: "September 2026", sales: { taxable: 180000, previous: 150000, change: 20, metres: 40000, ratePerMetre: 4.5 }, purchases: { taxable: 90000, change: 50 }, yarn: { perMetre: 1.2, change: 9.1 }, expenses: { total: 85000 }, overdue: { amount: 189000, over60: 0 } },
}));
vi.mock("@/core/http/httpClient", () => ({ httpClient: { get: (...a: unknown[]) => get(...(a as [])) }, ApiError: class extends Error {} }));

describe("the month review", () => {
  it("is written when asked, with the figures beside it", async () => {
    render(<QueryClientProvider client={new QueryClient()}><MonthReview month="2026-10" /></QueryClientProvider>);
    expect(get).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Write the month review/ }));
    expect(get).toHaveBeenCalledWith("/accounts/month-review", { month: "2026-10" });
    expect(await screen.findByRole("note")).toHaveTextContent("Power: ₹70,000 against a usual ₹41,000.");
    expect(screen.getByText("₹1.2")).toBeInTheDocument();
    expect(screen.getByText("▲ 9.1%")).toBeInTheDocument();
  });
});
