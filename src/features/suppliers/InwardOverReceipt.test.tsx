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

// The dialog's confirm shares its label with the form's submit; the
// dialog renders later, so the last match is the one inside it.
// (Array.prototype.at needs ES2022 and this project targets ES2020.)
const confirmButton = () => {
  const all = screen.getAllByRole("button", { name: /record inward/i });
  return all[all.length - 1];
};

describe("recording an inward that exceeds the order", () => {
  beforeEach(() => onSubmit.mockClear());

  it("says nothing while the quantity is within the order", async () => {
    renderForm();
    await typeQty("80");
    expect(screen.queryByText(/over the/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Reason for the excess/i)).not.toBeInTheDocument();
  });

  it("still raises the dialog inside the tolerance, with the reason optional", async () => {
    // Skipping the small ones left the prompt invisible exactly when
    // someone went looking for it.
    renderForm();
    await typeQty("108");

    expect(screen.getByText(/8 over the 100 ordered/)).toBeInTheDocument();
    expect(screen.getByText(/a reason is optional/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));
    expect(screen.getByText("This delivery is over the order")).toBeInTheDocument();
    // Nothing is required, so the confirm is live straight away.
    expect(confirmButton()).toBeEnabled();

    await userEvent.click(confirmButton());
    expect(onSubmit).toHaveBeenCalledWith([
      expect.objectContaining({ quantity: 108, excessReason: undefined }),
    ]);
  });

  it("does not raise the dialog when nothing is over", async () => {
    renderForm();
    await typeQty("80");
    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));

    expect(screen.queryByText("This delivery is over the order")).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalled();
  });

  it("raises the dialog past the tolerance rather than disabling the button", async () => {
    // A dead button with no way to satisfy it is the worse option.
    renderForm();
    await typeQty("130");
    expect(screen.getByRole("button", { name: /record inward/i })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));

    expect(screen.getByText("This delivery is over the order")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("holds the dialog shut until the required reason is given", async () => {
    renderForm();
    await typeQty("130");
    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));

    const confirm = confirmButton();
    expect(confirm).toBeDisabled();

    await userEvent.type(
      screen.getByLabelText(/Reason for the excess on Nylon 70D/i),
      "Supplier made up an earlier shortfall"
    );
    expect(confirm).toBeEnabled();
  });

  it("keeps what was typed when the dialog is dismissed and reopened", async () => {
    renderForm();
    await typeQty("130");
    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));
    await userEvent.type(
      screen.getByLabelText(/Reason for the excess on Nylon 70D/i),
      "Made up an earlier shortfall"
    );
    await userEvent.click(screen.getByRole("button", { name: /back/i }));

    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));
    expect(screen.getByLabelText(/Reason for the excess on Nylon 70D/i)).toHaveValue(
      "Made up an earlier shortfall"
    );
  });

  it("sends the reason on the row it belongs to", async () => {
    renderForm();
    await typeQty("130");
    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));
    await userEvent.type(
      screen.getByLabelText(/Reason for the excess on Nylon 70D/i),
      "Made up an earlier shortfall"
    );
    await userEvent.click(confirmButton());

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
    expect(screen.getByRole("button", { name: /record inward/i })).toBeEnabled();
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

  it("gives each over line its own box in the dialog", async () => {
    // The case that made a single shared box wrong: Nylon is 30 over and
    // needs a reason, Spandex is 2 over and does not.
    renderForm(twoLines);
    await typeQtyFor("Nylon 70D", "130");
    await typeQtyFor("Spandex 40D", "52");
    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));

    expect(screen.getByLabelText(/Reason for the excess on Nylon 70D/i)).toBeInTheDocument();
    // Within tolerance, but shown anyway — the dialog is open regardless,
    // and noting a small excess costs nothing.
    expect(screen.getByLabelText(/Reason for the excess on Spandex 40D/i)).toBeInTheDocument();
    expect(screen.getByText(/30 over 100 · past 10%/)).toBeInTheDocument();
    expect(screen.getByText(/2 over 50 · within 10%/)).toBeInTheDocument();
  });

  it("carries a different reason on each row", async () => {
    renderForm(twoLines);
    await typeQtyFor("Nylon 70D", "130");
    await typeQtyFor("Spandex 40D", "52");
    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));

    await userEvent.type(
      screen.getByLabelText(/Reason for the excess on Nylon 70D/i),
      "Made up an earlier shortfall"
    );
    await userEvent.type(
      screen.getByLabelText(/Reason for the excess on Spandex 40D/i),
      "Rounded up to a full cone"
    );
    await userEvent.click(confirmButton());

    expect(onSubmit).toHaveBeenCalledWith([
      expect.objectContaining({ rawMaterial: "m1", excessReason: "Made up an earlier shortfall" }),
      expect.objectContaining({ rawMaterial: "m2", excessReason: "Rounded up to a full cone" }),
    ]);
  });

  it("blocks on the unexplained line even when the other is filled", async () => {
    renderForm(twoLines);
    await typeQtyFor("Nylon 70D", "130");
    await typeQtyFor("Spandex 40D", "52");
    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));

    await userEvent.type(
      screen.getByLabelText(/Reason for the excess on Spandex 40D/i),
      "Rounded up to a full cone"
    );
    expect(confirmButton()).toBeDisabled();
  });

  it("drops a reason left behind when the quantity is edited back down", async () => {
    // A stale explanation attached to a line that is no longer over would
    // be worse than none — it would read as a fact about this receipt.
    renderForm();
    await typeQty("130");
    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));
    await userEvent.type(
      screen.getByLabelText(/Reason for the excess on Nylon 70D/i),
      "Made up an earlier shortfall"
    );
    await userEvent.click(screen.getByRole("button", { name: /back/i }));

    await userEvent.clear(screen.getByLabelText(/Quantity received for Nylon 70D/i));
    await userEvent.type(screen.getByLabelText(/Quantity received for Nylon 70D/i), "90");
    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));

    expect(onSubmit).toHaveBeenCalledWith([
      expect.objectContaining({ quantity: 90, excessReason: undefined }),
    ]);
  });
});
