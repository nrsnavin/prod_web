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
    photo: vi.fn(),
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
});
