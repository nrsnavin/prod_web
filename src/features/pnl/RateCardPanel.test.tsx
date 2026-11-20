import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RateCardPanel } from "./RateCardPanel";
import type { CostSettings } from "./types";

// Four of the seven cost lines come off this rate card, and it starts
// empty. A factory that never opens this panel gets a P&L where
// finishing, checking, packing and overhead are all ₹0 — every margin
// too good, every order looking healthy. So the panel's real job is to
// say that out loud, not to be a tidy settings form.

const { saveSettings, useCostSettings } = vi.hoisted(() => ({
  saveSettings: vi.fn(),
  useCostSettings: vi.fn(),
}));

vi.mock("./hooks", () => ({
  useCostSettings: () => useCostSettings(),
  usePnlMutations: () => ({
    saveSettings: { mutate: saveSettings, isPending: false },
    saveRates: { mutate: vi.fn(), isPending: false },
    saveOverrides: { mutate: vi.fn(), isPending: false },
  }),
}));

const settings = (over: Partial<CostSettings> = {}): CostSettings => ({
  finishingRatePerMeter: 2,
  checkingRatePerMeter: 1,
  packingRatePerMeter: 0.5,
  overheadRatePerMeter: 3,
  notes: "",
  configured: true,
  updatedAt: null,
  ...over,
});

function renderPanel(data?: CostSettings) {
  useCostSettings.mockReturnValue({ data, isLoading: !data });
  render(<RateCardPanel />);
}

beforeEach(() => {
  saveSettings.mockClear();
  useCostSettings.mockReset();
});

describe("an unset rate card", () => {
  it("says the four lines are costing nothing, rather than looking configured", () => {
    renderPanel(settings({
      configured: false,
      finishingRatePerMeter: 0, checkingRatePerMeter: 0,
      packingRatePerMeter: 0, overheadRatePerMeter: 0,
    }));
    expect(screen.getByText(/costing ₹0 on every order/i)).toBeInTheDocument();
    expect(screen.getByText(/every margin below is higher than the real one/i)).toBeInTheDocument();
  });

  it("stays quiet once it has been set", () => {
    renderPanel(settings());
    expect(screen.queryByText(/costing ₹0 on every order/i)).not.toBeInTheDocument();
  });
});

describe("saving", () => {
  it("posts only the fields that were edited", async () => {
    const user = userEvent.setup();
    renderPanel(settings());

    const overhead = screen.getByLabelText(/Overhead ₹\/m/i);
    await user.clear(overhead);
    await user.type(overhead, "4.5");
    await user.click(screen.getByRole("button", { name: /save rate card/i }));

    expect(saveSettings).toHaveBeenCalledTimes(1);
    expect(saveSettings.mock.calls[0][0]).toEqual({ overheadRatePerMeter: 4.5 });
  });

  // Before: a figure that could not be a rate was left out of the save
  // without a word. With another box changed too, that one was saved,
  // the form said "saved" and went back to the old figure in the first.
  it("does not save while a figure is not a rate, and says which", async () => {
    const user = userEvent.setup();
    renderPanel(settings());
    const finishing = screen.getByLabelText(/Finishing ₹\/m/i);
    await user.clear(finishing);
    await user.type(finishing, "5000000");
    const packing = screen.getByLabelText(/Packing ₹\/m/i);
    await user.clear(packing);
    await user.type(packing, "0.6");

    expect(screen.getByText("A rate per metre is between 0 and 10,00,000.")).toBeInTheDocument();
    expect(finishing).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: /save rate card/i })).toBeDisabled();
    expect(saveSettings).not.toHaveBeenCalled();

    // Put right, both go.
    await user.clear(finishing);
    await user.type(finishing, "2.5");
    await user.click(screen.getByRole("button", { name: /save rate card/i }));
    expect(saveSettings.mock.calls[0][0]).toEqual({ finishingRatePerMeter: 2.5, packingRatePerMeter: 0.6 });
  });

  it("a box emptied is left alone, as before", async () => {
    const user = userEvent.setup();
    renderPanel(settings());
    await user.clear(screen.getByLabelText(/Finishing ₹\/m/i));
    const overhead = screen.getByLabelText(/Overhead ₹\/m/i);
    await user.clear(overhead);
    await user.type(overhead, "4");
    await user.click(screen.getByRole("button", { name: /save rate card/i }));
    expect(saveSettings.mock.calls[0][0]).toEqual({ overheadRatePerMeter: 4 });
  });

  it("cannot be saved until something changes", () => {
    renderPanel(settings());
    expect(screen.getByRole("button", { name: /save rate card/i })).toBeDisabled();
  });

  it("shows the saved rates as the starting values", () => {
    renderPanel(settings());
    expect(screen.getByLabelText(/Finishing ₹\/m/i)).toHaveValue(2);
    expect(screen.getByLabelText(/Packing ₹\/m/i)).toHaveValue(0.5);
  });
});

// These four figures cost every metre the factory has made: change one
// and every order's margin, past ones too, changes with it. The card
// kept the time of its last save and no more.
describe("who last changed it", () => {
  it("is said, with what each figure was before", () => {
    renderPanel(settings({
      lastChange: { at: "2026-11-12T05:00:00.000Z", byName: "Meena", from: { finishingRatePerMeter: 1.5, overheadRatePerMeter: 3 }, to: { finishingRatePerMeter: 2, overheadRatePerMeter: 3.5 } },
    }));
    const line = screen.getByLabelText("Last change to the rate card");
    expect(line).toHaveTextContent("Last changed on 12 Nov 2026 by Meena");
    expect(line).toHaveTextContent("Finishing ₹1.50 → ₹2.00");
    expect(line).toHaveTextContent("Overhead ₹3.00 → ₹3.50");
    expect(line).toHaveTextContent("Every order is costed at the figures as they stand now.");
  });

  it("is not said for a card nobody has changed since this was kept", () => {
    renderPanel(settings({ lastChange: null }));
    expect(screen.queryByLabelText("Last change to the rate card")).not.toBeInTheDocument();
    renderPanel(settings());
    expect(screen.queryByLabelText("Last change to the rate card")).not.toBeInTheDocument();
  });
});
