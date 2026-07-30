import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DcForm } from "./DcForm";

// A delivery challan is not a tax invoice, so the printed document carries
// quantity only. The rate is still captured because the Dispatch Report is
// built on it — these pin that the form says so, rather than leaving the
// value looking like something that will appear on the challan.

vi.mock("./hooks", () => ({
  useDcMutations: () => ({ create: { mutate: vi.fn(), isPending: false } }),
  useDcOrderInfo: () => ({ data: undefined }),
}));
vi.mock("@/features/orders/hooks", () => ({
  useOrders: () => ({ orders: [], total: 0 }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const renderForm = () =>
  render(
    <MemoryRouter>
      <DcForm onCancel={vi.fn()} onSubmit={vi.fn()} submitting={false} />
    </MemoryRouter>
  );

describe("DcForm — rate is captured but internal", () => {
  it("still collects a rate, because the Dispatch Report needs it", () => {
    renderForm();
    expect(screen.getByLabelText(/rate in rupees/i)).toBeInTheDocument();
  });

  it("marks the rate column as internal", () => {
    renderForm();
    expect(screen.getByText("internal")).toBeInTheDocument();
  });

  it("tells the user the rate is never printed", () => {
    renderForm();
    const input = screen.getByLabelText(/rate in rupees/i);
    expect(input).toHaveAttribute("title", expect.stringMatching(/never printed/i));
  });

  it("calls the running figure a dispatch value, not a challan total", () => {
    renderForm();
    expect(screen.getByText(/dispatch value/i)).toBeInTheDocument();
    expect(screen.getByText(/printed challan shows\s+quantity only/i)).toBeInTheDocument();
  });
});
