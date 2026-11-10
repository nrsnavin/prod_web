import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { InlineConfirm } from "./InlineConfirm";
import { ReviewDialog } from "./ReviewDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { ToastProvider, useToast, UNDO_MS } from "./Toast";

// The four guards, lightest first. Each must make the common path quick
// and the dangerous one deliberate: one press alone never does the act.

describe("confirm in place", () => {
  it("turns into its question; only the second press acts", async () => {
    const onConfirm = vi.fn();
    render(
      <InlineConfirm question="Remove sensor S-04?" confirmLabel="Remove S-04" onConfirm={onConfirm} danger>
        Remove
      </InlineConfirm>
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("Remove sensor S-04?")).toBeInTheDocument();
    // The safe answer has focus, so Enter keeps things as they are.
    expect(screen.getByRole("button", { name: "Keep" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Remove S-04" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("backs out with Keep or Esc", async () => {
    const onConfirm = vi.fn();
    render(
      <InlineConfirm question="Withdraw this claim?" confirmLabel="Withdraw claim" onConfirm={onConfirm}>
        Withdraw
      </InlineConfirm>
    );
    await userEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("Withdraw this claim?")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("review, then act", () => {
  const base = {
    open: true,
    title: "Register e-invoice INV-42 with the GST portal",
    rows: [
      { label: "Buyer GSTIN", value: "29ABCDE1234F1Z5" },
      { label: "Invoice total", value: "₹4,09,500", strong: true },
    ],
    confirmLabel: "Register with GST portal",
    onCancel: () => {},
  };

  it("shows what will be sent and stays locked until the tick", async () => {
    const onConfirm = vi.fn();
    render(<ReviewDialog {...base} acknowledge="I have checked the buyer's GSTIN and the amounts." onConfirm={onConfirm} />);
    expect(screen.getByText("29ABCDE1234F1Z5")).toBeInTheDocument();
    const go = screen.getByRole("button", { name: "Register with GST portal" });
    expect(go).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(go).toBeEnabled();
    await userEvent.click(go);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("asks for the exact document number when told to", async () => {
    const onConfirm = vi.fn();
    render(<ReviewDialog {...base} typeToConfirm="INV-42" onConfirm={onConfirm} />);
    const go = screen.getByRole("button", { name: "Register with GST portal" });
    await userEvent.type(screen.getByLabelText(/to confirm/i), "INV-4");
    expect(go).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/to confirm/i), "2");
    expect(go).toBeEnabled();
    await userEvent.click(go);
    expect(onConfirm).toHaveBeenCalled();
  });

  it("passes the reason on, and won't act without one", async () => {
    const onConfirm = vi.fn();
    render(<ReviewDialog {...base} title="Cancel covering CV-12" confirmLabel="Cancel covering" danger reason={{ minLength: 5 }} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel covering" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("Give a reason of at least 5 characters.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Reason"), "Wrong beam set");
    await userEvent.click(screen.getByRole("button", { name: "Cancel covering" }));
    expect(onConfirm).toHaveBeenCalledWith("Wrong beam set");
  });
});

describe("confirm with consequences", () => {
  it("lists what changes under the message", () => {
    render(
      <ConfirmDialog
        open
        title="Complete order #4?"
        message="Order #4 moves to Completed."
        consequences={[{ text: "10,500 of 14,000 m have not been produced.", tone: "warning" }, { text: "Nothing has been delivered." }]}
        confirmLabel="Complete order #4"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText("10,500 of 14,000 m have not been produced.")).toBeInTheDocument();
    expect(screen.getByText("Nothing has been delivered.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete order #4" })).toBeInTheDocument();
  });
});

describe("undo", () => {
  afterEach(() => vi.useRealTimers());

  function Harness({ onUndo }: { onUndo: () => void }) {
    const { toast } = useToast();
    return (
      <button type="button" onClick={() => toast("Lot L-2311 held back", "success", { action: { label: "Undo", onClick: onUndo } })}>
        Hold back
      </button>
    );
  }

  it("offers Undo long enough to reach it, and runs it once", async () => {
    const onUndo = vi.fn();
    render(<ToastProvider><Harness onUndo={onUndo} /></ToastProvider>);
    await userEvent.click(screen.getByRole("button", { name: "Hold back" }));
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Lot L-2311 held back")).not.toBeInTheDocument();
  });

  it("leaves after the undo window, not the usual 3.5 seconds", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Harness onUndo={() => {}} /></ToastProvider>);
    act(() => screen.getByRole("button", { name: "Hold back" }).click());
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText("Lot L-2311 held back")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(UNDO_MS));
    expect(screen.queryByText("Lot L-2311 held back")).not.toBeInTheDocument();
  });
});
