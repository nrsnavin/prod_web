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
