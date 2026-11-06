import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OpeningOnboardingCard } from "./OpeningOnboardingCard";

// Opening balances on the dashboard: each party set right in the list,
// and the card gone once every one is.

const svc = {
  openingOnboarding: vi.fn(),
  setOpeningAsOn: vi.fn(),
  markOpeningNone: vi.fn(),
  closeOpeningOnboarding: vi.fn(),
  createOpening: vi.fn(),
  bulkOpening: vi.fn(),
};
vi.mock("./api", () => ({ accountsService: new Proxy({}, { get: (_t, k: string) => (svc as Record<string, unknown>)[k] }) }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
let role = "accounts";
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role } }) }));

const active = {
  success: true, active: true, asOn: "2026-03-31", asOnSaved: false,
  customers: { total: 3, left: 2 }, suppliers: { total: 1, left: 1 }, more: 0,
  left: [
    { partyType: "customer", _id: "c1", name: "Kumar Knits", gstin: "33AAEPS1001F1Z2" },
    { partyType: "customer", _id: "c2", name: "Sunrise Garments", gstin: "" },
    { partyType: "supplier", _id: "s1", name: "Sri Yarn Traders", gstin: "" },
  ],
};
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><OpeningOnboardingCard /></MemoryRouter></QueryClientProvider>);

beforeEach(() => {
  for (const f of Object.values(svc)) f.mockReset();
  toast.mockReset(); role = "accounts";
});

describe("opening balances on the dashboard", () => {
  it("says how far along it is, and sets a party's balance, or nothing owed, right in the list", async () => {
    svc.openingOnboarding.mockResolvedValue(active);
    svc.createOpening.mockResolvedValue({ _id: "o1", docNo: "OB/2025-26/0001", amount: 48500 });
    svc.markOpeningNone.mockResolvedValue({ success: true });
    wrap();
    const card = await screen.findByLabelText("Opening balances");
    expect(card).toHaveTextContent("1 of 3 customers set");
    expect(card).toHaveTextContent("0 of 1 suppliers set");
    expect(within(card).getByLabelText("Balances as on")).toHaveValue("2026-03-31");

    const sunrise = within(card).getByLabelText("Sunrise Garments");
    expect(within(sunrise).getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.type(within(sunrise).getByLabelText("Sunrise Garments: amount"), "48500");
    await userEvent.click(within(sunrise).getByRole("button", { name: "Save" }));
    expect(svc.createOpening).toHaveBeenCalledWith(expect.objectContaining({ partyType: "customer", party: "c2", kind: "due", date: "2026-03-31", amount: 48500 }));
    expect(toast).toHaveBeenCalledWith("Sunrise Garments: ₹48,500.00 they owe us · OB/2025-26/0001", "success");

    // A supplier's sides are said from our side.
    const yarn = within(card).getByLabelText("Sri Yarn Traders");
    expect(within(yarn).getByLabelText("Sri Yarn Traders: which way")).toHaveTextContent("We owe them");
    await userEvent.click(within(yarn).getByRole("button", { name: "Nothing owed" }));
    expect(svc.markOpeningNone).toHaveBeenCalledWith({ partyType: "supplier", party: "s1" }, expect.anything());
    expect(toast).toHaveBeenCalledWith("Sri Yarn Traders: nothing owed", "success");
    // Only an admin may stop it.
    expect(within(card).queryByRole("button", { name: "Stop showing this" })).not.toBeInTheDocument();
  });

  it("takes a party bill by bill, each bill with its own date", async () => {
    svc.openingOnboarding.mockResolvedValue(active);
    svc.bulkOpening.mockResolvedValue({ success: true, posted: 2, failed: 0, results: [{ index: 0, ok: true }, { index: 1, ok: true }] });
    wrap();
    const card = await screen.findByLabelText("Opening balances");
    await userEvent.click(within(card).getByRole("button", { name: "Kumar Knits: bill by bill" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Bill 1 number"), "INV-1182");
    await userEvent.type(within(dialog).getByLabelText("Bill 1 amount"), "30000");
    await userEvent.clear(within(dialog).getByLabelText("Bill 2 date"));
    await userEvent.type(within(dialog).getByLabelText("Bill 2 date"), "2026-02-14");
    await userEvent.type(within(dialog).getByLabelText("Bill 2 amount"), "18500");
    expect(dialog).toHaveTextContent("2 bills · they owe us ₹48,500.00 net");
    await userEvent.click(within(dialog).getByRole("button", { name: /Post 2 bills/ }));
    const rows = svc.bulkOpening.mock.calls[0][0];
    expect(rows).toEqual([
      expect.objectContaining({ partyType: "customer", party: "c1", kind: "due", refNo: "INV-1182", date: "2026-03-31", amount: 30000 }),
      expect.objectContaining({ party: "c1", date: "2026-02-14", amount: 18500 }),
    ]);
    expect(rows[0].requestId).not.toBe(rows[1].requestId);
    expect(toast).toHaveBeenCalledWith("Kumar Knits: 2 bills posted", "success");
  });

  it("an admin may stop it", async () => {
    role = "admin";
    svc.openingOnboarding.mockResolvedValue(active);
    svc.closeOpeningOnboarding.mockResolvedValue({ success: true, left: 3 });
    wrap();
    const card = await screen.findByLabelText("Opening balances");
    await userEvent.click(within(card).getByRole("button", { name: "Stop showing this" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("3 parties have no opening balance yet");
    await userEvent.click(within(dialog).getByRole("button", { name: "Stop showing" }));
    expect(svc.closeOpeningOnboarding).toHaveBeenCalled();
  });

  it("is not there once done, and says so the once it finishes", async () => {
    svc.openingOnboarding.mockResolvedValue({ success: true, active: false, completedAt: "2026-11-01T00:00:00Z" });
    const { unmount } = wrap();
    await vi.waitFor(() => expect(svc.openingOnboarding).toHaveBeenCalled());
    expect(screen.queryByLabelText("Opening balances")).not.toBeInTheDocument();
    unmount();

    svc.openingOnboarding.mockResolvedValue({ success: true, active: false, justFinished: true, completedAt: "2026-11-06T00:00:00Z" });
    wrap();
    expect(await screen.findByText("Every opening balance is set")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Every opening balance is set")).not.toBeInTheDocument();
  });
});
