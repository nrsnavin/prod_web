import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ClaimsPage } from "./ClaimsPage";

// Anyone files a claim from the phone and sees where it stands.

const create = vi.fn(async (b: Record<string, unknown>) => ({ _id: "e1", expenseNo: "EXP/2026-27/0009", ...b }));
vi.mock("./api", () => ({
  claimsService: {
    categories: async () => [{ _id: "c1", name: "Fuel" }],
    mine: async () => ({ claims: [{ _id: "e0", expenseNo: "EXP/2026-27/0001", date: "2026-07-01", categoryName: "Fuel", description: "Toll", totals: { grand: 120 }, status: "rejected", approval: { note: "No receipt" } }], owed: 0, waiting: 0 }),
    create: (b: Record<string, unknown>) => create(b),
    withdraw: vi.fn(),
    photo: vi.fn(async () => undefined),
    scan: async () => ({ problem: null, aiSuggestion: "ai1", alreadyClaimed: "EXP/2026-27/0003", categoryName: "Fuel", categoryReason: "3 of the last 3 expenses to Indian Oil were Fuel",
      draft: { amount: 960, date: "2026-11-01", description: "Diesel 10 L — Indian Oil", refNo: "IO/551", category: "c1" } }),
  },
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("expense claims", () => {
  it("shows why a claim was rejected and sends a new one for approval", async () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ClaimsPage /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText("No receipt")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /new claim/i }));
    await userEvent.selectOptions(await screen.findByLabelText("What was it for? *"), "c1");
    await userEvent.type(screen.getByLabelText("Details *"), "Diesel for the genset");
    await userEvent.type(screen.getByLabelText("Amount (₹) *"), "800");
    await userEvent.click(screen.getByRole("button", { name: /send for approval/i }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ category: "c1", description: "Diesel for the genset", amount: 800 }));
  });

  it("reads the receipt photo into the claim, warns if it was claimed before, and sends what the claimant checked", async () => {
    create.mockClear();
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ClaimsPage /></MemoryRouter></QueryClientProvider>);
    await userEvent.click(await screen.findByRole("button", { name: /new claim/i }));
    await screen.findByRole("option", { name: "Fuel" });
    await userEvent.upload(screen.getByLabelText("Receipt photo"), new File(["x"], "receipt.jpg", { type: "image/jpeg" }));
    expect(await screen.findByText(/Filled in from the receipt/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("already claimed as EXP/2026-27/0003");
    expect(screen.getByLabelText("Details *")).toHaveValue("Diesel 10 L — Indian Oil");
    expect(screen.getByLabelText("Amount (₹) *")).toHaveValue(960);
    expect(screen.getByLabelText("What was it for? *")).toHaveValue("c1");
    await userEvent.clear(screen.getByLabelText("Amount (₹) *"));
    await userEvent.type(screen.getByLabelText("Amount (₹) *"), "950");
    await userEvent.click(screen.getByRole("button", { name: /send for approval/i }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ amount: 950, date: "2026-11-01", refNo: "IO/551", aiSuggestion: "ai1" }));
  });
});
