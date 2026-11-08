import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PayrollCheckPanel, PayFlags } from "./PayrollCheck";

// The month's payslips checked before paying: what is unusual, in figures.

const get = vi.fn();
vi.mock("@/core/http/httpClient", () => ({ httpClient: { get: (...a: unknown[]) => get(...a) } }));

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe("PayrollCheckPanel", () => {
  it("says how many slips to look at, and why", async () => {
    get.mockResolvedValue({ data: {
      summary: { slips: 5, high: 1, check: 1, info: 1, totalNet: 75000, lastMonthNet: 60000 },
      rows: [
        { payrollId: "a", employeeId: "e1", name: "Idle", status: "draft", netPay: 4000, flags: [{ code: "no-work-pay", severity: "high", reason: "Pays ₹4,000 with no shift worked this month" }] },
        { payrollId: "b", employeeId: "e2", name: "Newbie", status: "draft", netPay: 15000, flags: [{ code: "first", severity: "info", reason: "First payslip" }] },
      ],
    } });
    wrap(<PayrollCheckPanel year={2026} month={11} />);
    expect(await screen.findByText(/2 payslips to look at before paying/)).toBeInTheDocument();
    expect(screen.getByText(/no shift worked/)).toBeInTheDocument();
    expect(screen.getByText(/up 25% on last month/)).toBeInTheDocument();
    // Notes are kept out of the way until asked for.
    expect(screen.queryByText("First payslip")).not.toBeInTheDocument();
  });
});

describe("PayFlags", () => {
  it("warns in the pay dialog, leaving plain notes out", () => {
    render(<PayFlags flags={[{ code: "jump", severity: "check", reason: "Net pay up 47%" }, { code: "rate", severity: "info", reason: "Rate changed" }]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Net pay up 47%");
    expect(screen.queryByText("Rate changed")).not.toBeInTheDocument();
  });

  it("shows nothing when there is nothing to look at", () => {
    const { container } = render(<PayFlags flags={[{ code: "first", severity: "info", reason: "First payslip" }]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
