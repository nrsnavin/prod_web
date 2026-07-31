import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InwardForm } from "./PoDetailPage";
import { PoItem } from "./types";

const onSubmit = vi.fn();

// Typed as PoItem so the fixture has to keep up with the real line shape
// rather than drifting into whatever the form happens to read today.
const line = (over: Partial<PoItem> = {}): PoItem => ({
  rawMaterial: { _id: "m1", name: "Nylon 70D" },
  price: 320,
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
    expect(screen.queryByText(/over the/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Reason for the excess/i)).not.toBeInTheDocument();
  });

  it("notes an excess inside the tolerance and still offers a reason box", async () => {
    renderForm();
    await typeQty("108");

    expect(screen.getByText(/8 over the 100 ordered/)).toBeInTheDocument();
    expect(screen.getByText(/no reason needed/)).toBeInTheDocument();
    // Optional, not absent — someone may want to note it anyway.
    expect(
      screen.getByLabelText(/Reason for the excess on Nylon 70D/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record inward/i })).toBeEnabled();
  });

  it("asks for a reason past the tolerance and blocks until it has one", async () => {
    renderForm();
    await typeQty("130");

    expect(screen.getByText(/past the 10% tolerance/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record inward/i })).toBeDisabled();
    // The blocked submit names the line, rather than leaving a dead button.
    expect(screen.getByText(/Reason needed for Nylon 70D/)).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText(/Reason for the excess on Nylon 70D/i),
      "Supplier made up an earlier shortfall"
    );
    expect(screen.getByRole("button", { name: /record inward/i })).toBeEnabled();
  });

  it("sends the reason on the row it belongs to", async () => {
    renderForm();
    await typeQty("130");
    await userEvent.type(
      screen.getByLabelText(/Reason for the excess on Nylon 70D/i),
      "Made up an earlier shortfall"
    );
    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));

    expect(onSubmit).toHaveBeenCalledWith([
      expect.objectContaining({
        rawMaterial: "m1",
        quantity: 130,
        excessReason: "Made up an earlier shortfall",
      }),
    ]);
  });

  it("measures the excess against the order, not what is still pending", async () => {
    // 100 ordered, 90 in, 12 more: 2 over the order, not 2 over of 10.
    renderForm([line({ received: 90 })]);
    await typeQty("12");

    expect(screen.getByText(/2 over the 100 ordered/)).toBeInTheDocument();
    expect(screen.getByText(/within the 10% tolerance/)).toBeInTheDocument();
  });

  it("still offers a fully received line, so extra can be recorded against it", async () => {
    // Hiding it would leave a stock adjustment as the only route, which
    // credits the same goods while losing the link to this PO.
    renderForm([line({ received: 100 })]);
    expect(screen.getByText(/fully received \(100 ordered\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Quantity received for Nylon 70D/i)).toBeEnabled();
  });
});

describe("two lines over at once", () => {
  beforeEach(() => onSubmit.mockClear());

  const twoLines = [
    line(),
    { ...line(), rawMaterial: { _id: "m2", name: "Spandex 40D" }, quantity: 50 },
  ];

  const typeQtyFor = (name: string, n: string) =>
    userEvent.type(screen.getByLabelText(new RegExp(`Quantity received for ${name}`, "i")), n);

  it("explains each line separately", async () => {
    // The case that made a single shared box wrong: Nylon is 30 over and
    // needs a reason, Spandex is 2 over and does not.
    renderForm(twoLines);
    await typeQtyFor("Nylon 70D", "130");
    await typeQtyFor("Spandex 40D", "52");

    expect(screen.getByText(/30 over the 100 ordered/)).toBeInTheDocument();
    expect(screen.getByText(/2 over the 50 ordered/)).toBeInTheDocument();
    expect(screen.getByText(/Reason needed for Nylon 70D/)).toBeInTheDocument();
  });

  it("carries a different reason on each row", async () => {
    renderForm(twoLines);
    await typeQtyFor("Nylon 70D", "130");
    await typeQtyFor("Spandex 40D", "52");

    await userEvent.type(
      screen.getByLabelText(/Reason for the excess on Nylon 70D/i),
      "Made up an earlier shortfall"
    );
    await userEvent.type(
      screen.getByLabelText(/Reason for the excess on Spandex 40D/i),
      "Rounded up to a full cone"
    );
    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));

    expect(onSubmit).toHaveBeenCalledWith([
      expect.objectContaining({ rawMaterial: "m1", excessReason: "Made up an earlier shortfall" }),
      expect.objectContaining({ rawMaterial: "m2", excessReason: "Rounded up to a full cone" }),
    ]);
  });

  it("blocks on the unexplained line even when the other is fine", async () => {
    renderForm(twoLines);
    await typeQtyFor("Nylon 70D", "130");
    await typeQtyFor("Spandex 40D", "52");
    await userEvent.type(
      screen.getByLabelText(/Reason for the excess on Spandex 40D/i),
      "Rounded up to a full cone"
    );

    expect(screen.getByRole("button", { name: /record inward/i })).toBeDisabled();
    expect(screen.getByText(/Reason needed for Nylon 70D/)).toBeInTheDocument();
  });

  it("drops a reason left behind when the quantity is edited back down", async () => {
    // A stale explanation attached to a line that is no longer over would
    // be worse than none — it would read as a fact about this receipt.
    renderForm();
    await typeQty("130");
    await userEvent.type(
      screen.getByLabelText(/Reason for the excess on Nylon 70D/i),
      "Made up an earlier shortfall"
    );
    await userEvent.clear(screen.getByLabelText(/Quantity received for Nylon 70D/i));
    await userEvent.type(screen.getByLabelText(/Quantity received for Nylon 70D/i), "90");
    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));

    expect(onSubmit).toHaveBeenCalledWith([
      expect.objectContaining({ quantity: 90, excessReason: undefined }),
    ]);
  });
});
