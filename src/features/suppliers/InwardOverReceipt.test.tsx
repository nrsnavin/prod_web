import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InwardForm } from "./PoDetailPage";

const onSubmit = vi.fn();

const line = (over: Partial<{ quantity: number; received: number }> = {}) => ({
  rawMaterial: { _id: "m1", name: "Nylon 70D" },
  quantity: 100,
  received: 0,
  ...over,
});

const renderForm = (items = [line()]) =>
  render(
    <InwardForm items={items} submitting={false} onSubmit={onSubmit} onCancel={vi.fn()} />
  );

const typeQty = (n: string) =>
  userEvent.type(screen.getByLabelText(/Quantity received for Nylon 70D/i), n);

describe("recording an inward that exceeds the order", () => {
  beforeEach(() => onSubmit.mockClear());

  it("says nothing while the quantity is within the order", async () => {
    renderForm();
    await typeQty("80");
    expect(screen.queryByText(/over$/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Reason for the excess/i)).not.toBeInTheDocument();
  });

  it("notes an excess inside the tolerance without demanding a reason", async () => {
    renderForm();
    await typeQty("108");

    expect(screen.getByText(/Nylon 70D: 8 over/)).toBeInTheDocument();
    expect(screen.getByText(/Within the 10% tolerance, no reason needed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record inward/i })).toBeEnabled();
  });

  it("asks for a reason past the tolerance and blocks until it has one", async () => {
    renderForm();
    await typeQty("130");

    expect(screen.getByText(/Past the 10% tolerance/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record inward/i })).toBeDisabled();

    await userEvent.type(
      screen.getByLabelText(/Reason for the excess \(required\)/i),
      "Supplier made up an earlier shortfall"
    );
    expect(screen.getByRole("button", { name: /record inward/i })).toBeEnabled();
  });

  it("sends the reason along with the rows", async () => {
    renderForm();
    await typeQty("130");
    await userEvent.type(
      screen.getByLabelText(/Reason for the excess/i),
      "Made up an earlier shortfall"
    );
    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      [expect.objectContaining({ rawMaterial: "m1", quantity: 130 })],
      "Made up an earlier shortfall"
    );
  });

  it("measures the excess against the order, not what is still pending", async () => {
    // 100 ordered, 90 in, 12 more: 2 over the order, not 2 over of 10.
    renderForm([line({ received: 90 })]);
    await typeQty("12");

    expect(screen.getByText(/Nylon 70D: 2 over/)).toBeInTheDocument();
    expect(screen.getByText(/Within the 10% tolerance/)).toBeInTheDocument();
  });

  it("still offers a fully received line, so extra can be recorded against it", async () => {
    // Hiding it would leave a stock adjustment as the only route, which
    // credits the same goods while losing the link to this PO.
    renderForm([line({ received: 100 })]);
    expect(screen.getByText(/fully received \(100 ordered\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Quantity received for Nylon 70D/i)).toBeEnabled();
  });
});
