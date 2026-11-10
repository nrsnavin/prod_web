import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AutoVerifiedList, AutoVerifySettings, ShiftEndReminderSettings } from "./AutoVerify";

// Verified by the rule: the admin turns it on, and the office sees what it verified.

const productionSettings = vi.fn();
const saveProductionSettings = vi.fn();
const autoVerified = vi.fn();
const sendShiftEndNudge = vi.fn();
vi.mock("./api", () => ({
  shiftService: {
    sendShiftEndNudge: (...a: unknown[]) => sendShiftEndNudge(...a),
    productionSettings: (...a: unknown[]) => productionSettings(...a),
    saveProductionSettings: (...a: unknown[]) => saveProductionSettings(...a),
    autoVerified: (...a: unknown[]) => autoVerified(...a),
  },
}));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
let role = "admin";
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role } }) }));

const settings = (enabled = false, over: object = {}) => ({
  autoVerify: { enabled, tolerancePct: 10, minShifts: 8, ...over },
  shiftEndNudge: { enabled: false, minutesBefore: 30, phones: [] },
});
const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  productionSettings.mockReset(); saveProductionSettings.mockReset(); autoVerified.mockReset(); toast.mockReset();
  role = "admin";
});

describe("auto-verification", () => {
  it("is off until an admin turns it on, and the band can be changed", async () => {
    productionSettings.mockResolvedValue(settings());
    saveProductionSettings.mockResolvedValueOnce(settings(true));
    wrap(<AutoVerifySettings />);
    const box = await screen.findByLabelText("Verify entries automatically");
    expect(box).not.toBeChecked();
    expect(screen.getByText(/within ±10% of what that loom makes/)).toBeInTheDocument();

    await userEvent.click(box);
    expect(saveProductionSettings).toHaveBeenCalledWith({ autoVerify: { enabled: true } });
    expect(await screen.findByText("on")).toBeInTheDocument();

    saveProductionSettings.mockResolvedValueOnce(settings(true, { tolerancePct: 15 }));
    const pct = screen.getByLabelText("Within ± %");
    await userEvent.clear(pct);
    await userEvent.type(pct, "15");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(saveProductionSettings).toHaveBeenLastCalledWith({ autoVerify: { tolerancePct: 15 } });
    expect(await screen.findByText(/within ±15%/)).toBeInTheDocument();
  });

  it("is shown but not changeable for anyone but an admin", async () => {
    role = "production";
    productionSettings.mockResolvedValue(settings(true));
    wrap(<AutoVerifySettings />);
    expect(await screen.findByLabelText("Verify entries automatically")).toBeDisabled();
    expect(screen.getByText(/An admin can change this/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Within ± %")).not.toBeInTheDocument();
  });

  it("lists what it verified, with what each was checked against", async () => {
    autoVerified.mockResolvedValue([{
      _id: "sd1", date: "2026-11-04T00:00:00.000Z", shift: "DAY", machine: "LOOM-02", operator: "Ravi", perHead: 455, timer: "7:30:00",
      at: "2026-11-04T10:00:00Z", expected: 450, low: 405, high: 495, tolerancePct: 10, shifts: 30,
    }]);
    wrap(<AutoVerifiedList />);
    const card = await screen.findByLabelText("Verified automatically");
    expect(autoVerified).toHaveBeenCalledWith(2);
    const row = within(card).getByText("LOOM-02").closest("tr")!;
    expect(row).toHaveTextContent("Ravi");
    expect(row).toHaveTextContent("455 m");
    expect(row).toHaveTextContent("450 m (405–495, 30 shifts)");
  });

  it("shows nothing when nothing was verified by the rule", async () => {
    autoVerified.mockResolvedValue([]);
    const { container } = wrap(<AutoVerifiedList />);
    await vi.waitFor(() => expect(autoVerified).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the shift-end reminder", () => {
  it("is turned on by an admin, with the minutes and numbers, and can be sent now", async () => {
    productionSettings.mockResolvedValue(settings());
    saveProductionSettings.mockResolvedValueOnce({ ...settings(), shiftEndNudge: { enabled: true, minutesBefore: 30, phones: [] } });
    wrap(<ShiftEndReminderSettings />);
    const box = await screen.findByLabelText("Remind before the shift ends");
    expect(box).not.toBeChecked();
    expect(screen.getByText(/30 minutes before 8 AM and 8 PM, once a shift, to the notification recipients/)).toBeInTheDocument();
    await userEvent.click(box);
    expect(saveProductionSettings).toHaveBeenCalledWith({ shiftEndNudge: { enabled: true } });

    saveProductionSettings.mockResolvedValueOnce({ ...settings(), shiftEndNudge: { enabled: true, minutesBefore: 45, phones: ["+919840000001"] } });
    const mins = screen.getByLabelText("Minutes before");
    await userEvent.clear(mins);
    await userEvent.type(mins, "45");
    await userEvent.type(screen.getByLabelText("WhatsApp numbers (comma between)"), "98400 00001");
    const card = screen.getByLabelText("Shift-end reminder");
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));
    expect(saveProductionSettings).toHaveBeenLastCalledWith({ shiftEndNudge: { minutesBefore: 45, phones: "98400 00001" } });
    expect(await screen.findByText(/45 minutes before .* to \+919840000001/)).toBeInTheDocument();

    sendShiftEndNudge.mockResolvedValueOnce({ success: true, sent: true, looms: ["L1", "L2"] });
    await userEvent.click(screen.getByRole("button", { name: "Send now…" }));
    // A WhatsApp can't be recalled: one press only asks, naming who gets it.
    expect(sendShiftEndNudge).not.toHaveBeenCalled();
    expect(screen.getByText("Send the reminder now to +919840000001?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Send reminder" }));
    expect(toast).toHaveBeenCalledWith("Sent — 2 looms to enter", "success");
  });

  it("is shown, not changed, for anyone but an admin", async () => {
    role = "production";
    productionSettings.mockResolvedValue(settings());
    wrap(<ShiftEndReminderSettings />);
    expect(await screen.findByLabelText("Remind before the shift ends")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /send now/i })).not.toBeInTheDocument();
  });
});
