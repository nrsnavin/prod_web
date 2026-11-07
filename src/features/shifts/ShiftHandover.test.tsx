import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShiftHandoverSettings } from "./AutoVerify";

// The handover after each shift: turned on by an admin, previewed any time.

const saveProductionSettings = vi.fn(async () => ({ autoVerify: { enabled: false, tolerancePct: 10, minShifts: 8 }, shiftEndNudge: { enabled: false, minutesBefore: 30, phones: [] }, shiftHandover: { enabled: true, withinMinutes: 60, phones: [] } }));
vi.mock("./api", () => ({
  shiftService: {
    productionSettings: async () => ({ autoVerify: { enabled: false, tolerancePct: 10, minShifts: 8 }, shiftEndNudge: { enabled: false, minutesBefore: 30, phones: [] } }),
    saveProductionSettings: (...a: unknown[]) => saveProductionSettings(...(a as [])),
    handover: async () => ({ success: true, by: "rules", text: "🔁 *Handover — Day shift · 21 Oct*\nMetres: 410\nNot entered: B1" }),
    sendHandover: vi.fn(),
  },
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));

describe("the shift handover", () => {
  it("is off on a server that never set it, turns on, and shows the last shift's note", async () => {
    render(<QueryClientProvider client={new QueryClient()}><ShiftHandoverSettings /></QueryClientProvider>);
    const box = await screen.findByLabelText("Send the shift handover");
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(saveProductionSettings).toHaveBeenCalledWith({ shiftHandover: { enabled: true } });
    await userEvent.click(screen.getByRole("button", { name: "See the last shift's" }));
    expect(await screen.findByRole("note")).toHaveTextContent("Not entered: B1");
  });
});
