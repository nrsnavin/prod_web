import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EmployeeLeavePayCard } from "./EmployeeLeavePayCard";

const history = vi.fn();
const byEmployee = vi.fn();

vi.mock("@/features/hr/api", () => ({
  payrollService: { history: (id: string, n: number) => history(id, n) },
  leaveService: { byEmployee: (id: string) => byEmployee(id) },
}));

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <EmployeeLeavePayCard empId="e1" />
    </QueryClientProvider>
  );
}

describe("EmployeeLeavePayCard", () => {
  it("shows unpaid salary, recent payslips and leave requests", async () => {
    history.mockResolvedValue({
      payslips: [
        { _id: "p1", year: 2026, month: 6, netPay: 18000, status: "paid" },
        { _id: "p2", year: 2026, month: 7, netPay: 19500, status: "finalized" },
      ],
      unpaidTotal: 19500,
      unpaidCount: 1,
    });
    byEmployee.mockResolvedValue([
      { id: "l1", dateLabel: "05 Jul 2026", leaveType: "casual", shift: "BOTH", status: "approved" },
    ]);

    renderCard();

    // Wait for the pay data, then check the unpaid total in its own box.
    await screen.findByText("Jul 2026");
    expect(screen.getByText("Unpaid salary left").parentElement).toHaveTextContent("₹19,500");
    expect(screen.getByText(/1 unpaid payslip/)).toBeInTheDocument();
    // Leave row.
    expect(await screen.findByText("05 Jul 2026")).toBeInTheDocument();
    expect(screen.getByText("approved")).toBeInTheDocument();
  });

  it("hides itself when both endpoints error (unauthorized)", async () => {
    history.mockRejectedValue(new Error("403"));
    byEmployee.mockRejectedValue(new Error("403"));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <EmployeeLeavePayCard empId="e1" />
      </QueryClientProvider>
    );
    // Once both queries settle to error the component renders nothing.
    await waitFor(() => expect(container.querySelector("h3")).toBeNull());
  });
});
