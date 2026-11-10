import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ReasonDialog } from "./ReasonDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { Modal } from "./Modal";

// Every reason dialog used to open with "Please give a brief reason" in
// red and the cursor on the close button: the box took focus, the
// dialog then moved focus to its first button, and the blur marked the
// box as touched. Typing went nowhere until the box was clicked.

describe("ReasonDialog", () => {
  it("opens quiet, with the cursor in the reason box", async () => {
    render(<ReasonDialog open onClose={() => {}} onConfirm={() => {}} title="Delete order #1" confirmLabel="Delete order" />);
    const box = screen.getByLabelText("Reason");
    // The dialog places focus on a timer; give it the chance to steal.
    await new Promise((r) => setTimeout(r, 20));
    expect(box).toHaveFocus();
    expect(box).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText(/give a reason of at least/i)).not.toBeInTheDocument();
    expect(screen.getByText(/saved to the audit trail/i)).toBeInTheDocument();
  });

  it("explains only when confirm is pressed too early, using the caller's minimum", async () => {
    const onConfirm = vi.fn();
    render(
      <ReasonDialog open onClose={() => {}} onConfirm={onConfirm} title="Cancel bill B-12" minLength={10} confirmLabel="Cancel bill" />
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel bill" }));
    expect(onConfirm).not.toHaveBeenCalled();
    // It said "min 3 characters" whatever the minimum really was.
    expect(screen.getByText("Give a reason of at least 10 characters.")).toBeInTheDocument();
    expect(screen.getByLabelText("Reason")).toHaveAttribute("aria-invalid", "true");

    await userEvent.type(screen.getByLabelText("Reason"), "Entered twice");
    await userEvent.click(screen.getByRole("button", { name: "Cancel bill" }));
    expect(onConfirm).toHaveBeenCalledWith("Entered twice");
  });
});

describe("where a dialog puts focus when it opens", () => {
  it("starts in the first field, not on the close button", async () => {
    render(
      <Modal open onClose={() => {}} title="New lot">
        <label htmlFor="lot">Lot number</label>
        <input id="lot" />
        <button type="button">Save</button>
      </Modal>
    );
    await waitFor(() => expect(screen.getByLabelText("Lot number")).toHaveFocus());
  });

  it("starts a confirmation on its first button, the safe one", async () => {
    render(
      <ConfirmDialog open title="Delete plan?" message="The plan is removed." confirmLabel="Delete plan" danger onConfirm={() => {}} onCancel={() => {}} />
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("honours data-autofocus when a dialog wants something else first", async () => {
    render(
      <Modal open onClose={() => {}} title="Pick">
        <input aria-label="Search" />
        <button type="button" data-autofocus>Use last week's</button>
      </Modal>
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Use last week's" })).toHaveFocus());
  });
});
