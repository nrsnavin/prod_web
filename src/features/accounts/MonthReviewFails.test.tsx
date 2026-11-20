import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MonthReview } from "./MonthReview";

// Asked for and not written (the model timed out, the server said no): the
// card went blank — no review, no word of why, and the button that asks
// for it gone.

const get = vi.fn();
vi.mock("@/core/http/httpClient", async (orig) => ({
  ...(await orig<typeof import("@/core/http/httpClient")>()),
  httpClient: { get: (...a: unknown[]) => get(...a) },
}));

describe("the month review, when it cannot be written", () => {
  it("says so, and can be asked for again", async () => {
    get.mockRejectedValueOnce(new Error("The request took too long"));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MonthReview month="2026-10" /></QueryClientProvider>);
    await userEvent.click(screen.getByRole("button", { name: /Write the month review/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be written.*took too long/i);

    get.mockResolvedValueOnce({ month: "2026-10", by: "rules", points: ["Sales rose 4%"], figures: { label: "Oct", previous: "Sep", sales: { taxable: 100, previous: 96, change: 4, metres: 10, ratePerMetre: 10 }, purchases: { taxable: 50, change: null }, yarn: { perMetre: null, change: null }, expenses: { total: 5 }, overdue: { amount: 0, over60: 0 } } });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByText("Sales rose 4%")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
