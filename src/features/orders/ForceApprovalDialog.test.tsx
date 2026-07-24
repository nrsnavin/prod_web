import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForceApprovalDialog } from "./ForceApprovalDialog";
import { StockShortfall } from "./types";

const shortfall: StockShortfall = {
  materialId: "abc123",
  materialName: "Nylon 40D",
  available: 12,
  required: 30,
  short: 18,
};

function setup(overrides: Partial<React.ComponentProps<typeof ForceApprovalDialog>> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <ForceApprovalDialog
      open
      shortfall={shortfall}
      originalMessage="Insufficient stock for Nylon 40D (have 12, need 30)"
      onConfirm={onConfirm}
      onClose={onClose}
      {...overrides}
    />
  );
  return { onConfirm, onClose };
}

describe("ForceApprovalDialog", () => {
  it("renders the material shortfall so the admin sees the override", () => {
    setup();
    expect(screen.getByText("Nylon 40D")).toBeInTheDocument();
    expect(
      screen.getByText("Need 30 kg · Available 12 kg · Short 18 kg")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Insufficient stock for Nylon 40D/)
    ).toBeInTheDocument();
  });

  it("blocks force approval until the reason is at least 8 characters", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    await user.type(screen.getByPlaceholderText(/New stock arriving/), "short");
    await user.click(screen.getByRole("button", { name: /force approve/i }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByText(/at least 8 characters/i)
    ).toBeInTheDocument();
  });

  it("confirms with the trimmed reason when it is long enough", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    await user.type(
      screen.getByPlaceholderText(/New stock arriving/),
      "  New stock arriving tomorrow  "
    );
    await user.click(screen.getByRole("button", { name: /force approve/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("New stock arriving tomorrow");
  });

  it("cancels without confirming", async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = setup();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
