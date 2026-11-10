import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ══════════════════════════════════════════════════════════════════
//  MONEY OUT OF PAYROLL ASKS FIRST
//
//  Approving an advance fixes the month it is recovered in — the month
//  picked at the top of the page, which nobody looks at while clicking
//  a tick. Paying one out books cash to the employee. Rejecting closes
//  the request. Each used to be a single press on an unlabelled icon.
// ══════════════════════════════════════════════════════════════════

const svc = vi.hoisted(() => ({
  dashboard: vi.fn(),
  advances: vi.fn(),
  generate: vi.fn(),
  approveAdvance: vi.fn(),
  rejectAdvance: vi.fn(),
  payOutAdvance: vi.fn(),
  employeeAdvances: vi.fn(),
  pay: vi.fn(),
}));
vi.mock("./api", () => ({ payrollService: svc }));
vi.mock("./PayrollCheck", () => ({
  PayrollCheckPanel: () => null,
  PayFlags: () => null,
  usePayrollCheck: () => ({ data: undefined }),
}));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

import { PayrollPage } from "./PayrollPage";

const advance = (over = {}) => ({
  _id: "a1", employee: { _id: "e1", name: "Ravi" }, amount: 5000, remainingBalance: null,
  reason: "School fees", status: "requested", createdAt: "2026-11-02", ...over,
});

const open = async (rows: unknown[]) => {
  svc.advances.mockResolvedValue(rows);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><PayrollPage /></MemoryRouter>
    </QueryClientProvider>
  );
  await userEvent.click(screen.getByRole("button", { name: /^advances$/i }));
};

beforeEach(() => {
  Object.values(svc).forEach((f) => f.mockReset());
  svc.dashboard.mockResolvedValue({ summary: { totalNetPay: 0, totalGross: 0, totalDeductions: 0, totalBonuses: 0, perfectCount: 0, paidCount: 0, finalizedCount: 0, draftCount: 2 }, employees: [] });
  svc.approveAdvance.mockResolvedValue({});
  svc.rejectAdvance.mockResolvedValue({});
  svc.payOutAdvance.mockResolvedValue({});
  toast.mockReset();
});

describe("an advance request", () => {
  it("approving asks first and says which month's pay recovers it", async () => {
    await open([advance()]);
    await userEvent.click(await screen.findByRole("button", { name: "Approve…" }));
    expect(svc.approveAdvance).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/Recovered from .* pay, the month chosen at the top of this page/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Approve ₹5,000" }));
    expect(svc.approveAdvance).toHaveBeenCalledWith("a1", expect.any(Number), expect.any(Number));
  });

  it("rejecting asks in place, and Keep backs out", async () => {
    await open([advance()]);
    await userEvent.click(await screen.findByRole("button", { name: "Reject…" }));
    expect(svc.rejectAdvance).not.toHaveBeenCalled();
    expect(screen.getByText("Reject ₹5,000 for Ravi?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(svc.rejectAdvance).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Reject…" }));
    await userEvent.click(screen.getByRole("button", { name: "Reject request" }));
    expect(svc.rejectAdvance.mock.calls[0][0]).toBe("a1");
  });

  it("paying out shows the cash to hand over before booking it", async () => {
    await open([advance({ status: "approved", deductMonth: 12, deductYear: 2026 })]);
    await userEvent.click(await screen.findByRole("button", { name: "Pay out…" }));
    expect(svc.payOutAdvance).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Cash to hand over");
    expect(dialog).toHaveTextContent("December 2026 pay");
    await userEvent.click(within(dialog).getByRole("button", { name: "Pay out ₹5,000" }));
    expect(svc.payOutAdvance.mock.calls[0][0]).toBe("a1");
  });
});

describe("working out the month's pay", () => {
  it("says the draft slips it replaces and that paid slips are kept", async () => {
    await open([]);
    await userEvent.click(screen.getByRole("button", { name: /^generate/i }));
    expect(svc.generate).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("2 draft slips are worked out again and replaced.");
    expect(dialog).toHaveTextContent("Finalised, paid and part-paid slips are kept as they are.");
  });
});
