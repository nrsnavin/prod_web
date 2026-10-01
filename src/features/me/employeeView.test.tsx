import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { employeeSections, MY_WORK } from "./employeeNav";
import { dayLabel, EnterProductionScreen, normaliseTimer, shiftStatus } from "./components";
import { MyShift } from "./types";

const post = vi.fn();
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return { ...actual, httpClient: { get: vi.fn(), post: (...a: unknown[]) => post(...a) } };
});
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const shift = (over: Partial<MyShift> = {}): MyShift => ({
  id: "s1", date: new Date().toISOString(), shift: "DAY", status: "open", description: "", submitted: null,
  machine: { id: "m1", code: "LOOM-04", heads: 6, status: "running", manufacturer: "Comez" },
  heads: [], job: null, ...over,
});

describe("the employee menu", () => {
  it("is their own four screens plus notices, issues, feedback and settings — no manager screen", () => {
    const paths = employeeSections().flatMap((s) => s.items.map((i) => i.path));
    expect(paths).toEqual(["/my", "/my/shift", "/my/performance", "/my/pay", "/announcements", "/machine-issues", "/feedback", "/settings"]);
    for (const manager of ["/", "/orders", "/jobs", "/machines", "/payroll", "/employees", "/assistant"]) {
      expect(paths).not.toContain(manager);
    }
  });

  it("puts the same four in the bottom bar, Home first", () => {
    expect(MY_WORK.map((t) => t.label)).toEqual(["Home", "My shift", "Performance", "Pay"]);
  });
});

describe("shift helpers", () => {
  it("names the day the way a worker would", () => {
    const now = new Date(2026, 9, 1, 10);
    expect(dayLabel(new Date(2026, 9, 1, 2).toISOString(), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 2, 2).toISOString(), now)).toBe("Tomorrow");
    expect(dayLabel(new Date(2026, 8, 30, 2).toISOString(), now)).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 8, 20, 2).toISOString(), now)).toBe("20 Sep 2026");
  });

  it("says what is left to do", () => {
    expect(shiftStatus(shift()).text).toBe("Production to enter");
    expect(shiftStatus(shift({ status: "pending_verification" })).text).toBe("Waiting for verification");
  });

  it("reads 7.30 from a number keypad as 7:30", () => {
    expect(normaliseTimer(" 7.30 ")).toBe("7:30");
    expect(normaliseTimer("07:45:00")).toBe("07:45:00");
  });
});

describe("entering production", () => {
  beforeEach(() => { post.mockReset(); toast.mockReset(); });
  const open = (s: MyShift, onClose = vi.fn()) => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><EnterProductionScreen shift={s} onClose={onClose} /></MemoryRouter>
      </QueryClientProvider>
    );
    return onClose;
  };

  it("sends metres, run time and note for this shift, then closes", async () => {
    post.mockResolvedValue({ success: true });
    const onClose = open(shift());
    await userEvent.type(screen.getByLabelText("Metres produced"), "512");
    await userEvent.type(screen.getByLabelText("Run time"), "7.30");
    await userEvent.type(screen.getByLabelText("Note for the supervisor"), "warp break");
    await userEvent.click(screen.getByRole("button", { name: "Send for verification" }));
    expect(post).toHaveBeenCalledWith("/me/shifts/s1/production", { production: 512, timer: "7:30", feedback: "warp break" });
    expect(toast).toHaveBeenCalledWith("Sent for verification", "success");
    expect(onClose).toHaveBeenCalled();
  });

  it("asks for the metres before sending anything", async () => {
    open(shift());
    await userEvent.click(screen.getByRole("button", { name: "Send for verification" }));
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText("Enter the metres produced.")).toBeInTheDocument();
  });

  it("starts from what was already entered when changing an entry", () => {
    open(shift({ status: "pending_verification", submitted: { production: 300, timer: "6:00", feedback: "ok", at: null } }));
    expect(screen.getByLabelText("Metres produced")).toHaveValue(300);
    expect(screen.getByLabelText("Run time")).toHaveValue("6:00");
  });
});
