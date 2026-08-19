import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast, AUTO_DISMISS_MS } from "./Toast";

// ══════════════════════════════════════════════════════════════════
//  THE ONE MESSAGE THAT COSTS SOMETHING TO MISS
//
//  Every toast used to be dismissed on the same timer whatever it said.
//  Somebody taps Save, looks up at a loom for four seconds, and comes
//  back to a screen that looks exactly as it did before — except the
//  write failed and the only thing that ever said so has deleted
//  itself. They will believe it saved.
//
//  These hold the split: things that are safe to miss still leave on
//  their own; a failure stays until somebody actually dismisses it.
// ══════════════════════════════════════════════════════════════════

function Harness() {
  const { toast } = useToast();
  return (
    <>
      <button onClick={() => toast("Saved", "success")}>fire success</button>
      <button onClick={() => toast("Heads up", "info")}>fire info</button>
      <button onClick={() => toast("Save failed: machine is running", "error")}>
        fire error
      </button>
    </>
  );
}

const show = () => render(<ToastProvider><Harness /></ToastProvider>);
const fire = (which: RegExp) => screen.getByRole("button", { name: which });

/** Advance past the auto-dismiss window. */
const waitOutTheTimer = () =>
  act(() => { vi.advanceTimersByTime(AUTO_DISMISS_MS + 100); });

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe("what leaves on its own", () => {
  it("drops a success after the timer", async () => {
    show();
    await userEvent.click(fire(/fire success/i));
    expect(screen.getByText("Saved")).toBeInTheDocument();

    waitOutTheTimer();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("drops an info after the timer", async () => {
    show();
    await userEvent.click(fire(/fire info/i));
    waitOutTheTimer();
    expect(screen.queryByText("Heads up")).not.toBeInTheDocument();
  });

  it("gives them no close button — they are already going", async () => {
    show();
    await userEvent.click(fire(/fire success/i));
    expect(screen.queryByRole("button", { name: /dismiss message/i }))
      .not.toBeInTheDocument();
  });
});

describe("what stays", () => {
  it("keeps an error on screen past the old timer", async () => {
    // The whole point of the change.
    show();
    await userEvent.click(fire(/fire error/i));

    waitOutTheTimer();
    expect(screen.getByText(/save failed: machine is running/i)).toBeInTheDocument();
  });

  it("still holds it a long time later", async () => {
    show();
    await userEvent.click(fire(/fire error/i));
    act(() => { vi.advanceTimersByTime(10 * 60 * 1000); });
    expect(screen.getByText(/save failed/i)).toBeInTheDocument();
  });

  it("offers a way to dismiss it deliberately", async () => {
    show();
    await userEvent.click(fire(/fire error/i));
    await userEvent.click(screen.getByRole("button", { name: /dismiss message/i }));

    expect(screen.queryByText(/save failed/i)).not.toBeInTheDocument();
  });

  it("dismisses only the one that was closed", async () => {
    show();
    await userEvent.click(fire(/fire error/i));
    await userEvent.click(fire(/fire error/i));

    const closes = screen.getAllByRole("button", { name: /dismiss message/i });
    expect(closes).toHaveLength(2);
    await userEvent.click(closes[0]);
    expect(screen.getAllByText(/save failed/i)).toHaveLength(1);
  });
});

describe("how they are announced", () => {
  it("interrupts for a failure and waits its turn for a success", async () => {
    // A region's politeness is fixed when it is created, so this needs
    // two regions rather than one with a varying attribute.
    show();
    await userEvent.click(fire(/fire error/i));
    await userEvent.click(fire(/fire success/i));

    const assertive = document.querySelector('[aria-live="assertive"]')!;
    const polite = document.querySelector('[aria-live="polite"]')!;

    expect(assertive).toHaveTextContent(/save failed/i);
    expect(assertive).not.toHaveTextContent(/saved$/i);
    expect(polite).toHaveTextContent("Saved");
  });

  it("does not lose an error when a success arrives after it", async () => {
    show();
    await userEvent.click(fire(/fire error/i));
    await userEvent.click(fire(/fire success/i));
    waitOutTheTimer();

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.getByText(/save failed/i)).toBeInTheDocument();
  });
});
