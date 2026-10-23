import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FloorPinCard } from "./FloorPinCard";

// The floor PIN on the shift card: shown on request, copied, replaced.

const floorPin = vi.fn();
const rotateFloorPin = vi.fn();
vi.mock("./api", () => ({ shiftService: { floorPin: (...a: unknown[]) => floorPin(...a), rotateFloorPin: (...a: unknown[]) => rotateFloorPin(...a) } }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const pin = (over: object = {}) => ({
  dateKey: "2026-10-21", shift: "DAY", pin: "4821", generation: 1, opens: [], failedAttempts: 0, ...over,
});

const renderCard = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><FloorPinCard dateKey="2026-10-21" shift="DAY" /></QueryClientProvider>);
};

beforeEach(() => { floorPin.mockReset(); rotateFloorPin.mockReset(); toast.mockReset(); });

describe("the floor PIN card", () => {
  it("asks for the PIN only when shown, and says who opened with it", async () => {
    floorPin.mockResolvedValue(pin({ opens: [{ at: "2026-10-21T02:35:00Z", name: "Kumar" }], failedAttempts: 2 }));
    renderCard();
    expect(floorPin).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /show pin/i }));
    expect(await screen.findByText("4821")).toBeInTheDocument();
    expect(floorPin).toHaveBeenCalledWith("2026-10-21", "DAY");
    expect(screen.getByText(/Opened by Kumar at/)).toBeInTheDocument();
    expect(screen.getByText(/2 wrong tries/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the floor screen/i })).toHaveAttribute("href", "/floor");

    await userEvent.click(screen.getByRole("button", { name: /hide/i }));
    expect(screen.queryByText("4821")).not.toBeInTheDocument();
  });

  it("makes a new PIN after a confirmation", async () => {
    floorPin.mockResolvedValue(pin());
    rotateFloorPin.mockResolvedValue(pin({ pin: "9034", generation: 2 }));
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: /show pin/i }));
    await screen.findByText("4821");
    await userEvent.click(screen.getByRole("button", { name: /new pin/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/will have to enter the new one/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /^new pin$/i }));
    expect(await screen.findByText("9034")).toBeInTheDocument();
    expect(rotateFloorPin).toHaveBeenCalledWith("2026-10-21", "DAY");
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/New PIN made/), "success");
  });
});
