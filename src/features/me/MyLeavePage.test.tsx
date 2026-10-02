import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/core/http/httpClient";
import { MyLeavePage } from "./MyLeavePage";
import { addDays, daysBetween, localISO } from "./leave";
import type { MyLeave } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A WORKER'S LEAVE SCREEN
//
//  Shows each request with where it stands; applies for a day or a run
//  of days, one request per day, saying which days didn't go through;
//  cancels a pending request after asking.
// ══════════════════════════════════════════════════════════════════

const leaves = vi.fn();
const applyLeave = vi.fn();
const cancelLeave = vi.fn();
vi.mock("./api", () => ({
  meService: {
    leaves: () => leaves(),
    applyLeave: (b: unknown) => applyLeave(b),
    cancelLeave: (id: string) => cancelLeave(id),
  },
}));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { employeeId: "e1", selfService: true } }) }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const today = localISO(new Date());
const leave = (over: Partial<MyLeave>): MyLeave => ({
  id: "l1", date: addDays(today, 5), dateLabel: "07 Oct 2026", shift: "BOTH", leaveType: "casual",
  reason: "Family function", status: "pending", ...over,
});

function renderPage(path = "/my/leave") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <MyLeavePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  applyLeave.mockResolvedValue({ success: true });
  cancelLeave.mockResolvedValue({ success: true });
});

describe("the requests", () => {
  it("are listed with where each stands and the supervisor's note", async () => {
    leaves.mockResolvedValue([
      leave({ id: "a" }),
      leave({ id: "b", date: addDays(today, -10), dateLabel: "22 Sep 2026", status: "rejected", reviewNotes: "Short-staffed that week" }),
      leave({ id: "c", date: addDays(today, 9), dateLabel: "11 Oct 2026", status: "approved", shift: "NIGHT", leaveType: "sick" }),
    ]);
    renderPage();
    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
    expect(screen.getByText("Not approved")).toBeInTheDocument();
    expect(screen.getByText(/Short-staffed that week/)).toBeInTheDocument();
    expect(screen.getByText("Night shift · Sick leave")).toBeInTheDocument();
    // Only a pending request can be taken back.
    expect(screen.getAllByRole("button", { name: /cancel request/i })).toHaveLength(1);
  });

  it("can be cancelled while pending, after asking", async () => {
    leaves.mockResolvedValue([leave({ id: "a" })]);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /cancel request/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /cancel request/i }));
    await waitFor(() => expect(cancelLeave).toHaveBeenCalledWith("a"));
    expect(toast).toHaveBeenCalledWith("Request cancelled", "success");
  });

  it("says when there are none yet", async () => {
    leaves.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No leave requested yet")).toBeInTheDocument();
  });
});

describe("applying", () => {
  it("opens straight from Home's link, and sends one day", async () => {
    leaves.mockResolvedValue([]);
    renderPage("/my/leave?apply=1");
    const reason = await screen.findByLabelText(/reason/i);
    await userEvent.click(screen.getByRole("radio", { name: "Sick" }));
    await userEvent.type(reason, "Fever");
    await userEvent.click(screen.getByRole("button", { name: /^apply$/i }));
    await waitFor(() => expect(applyLeave).toHaveBeenCalledTimes(1));
    expect(applyLeave).toHaveBeenCalledWith({ date: addDays(today, 1), shift: "BOTH", leaveType: "sick", reason: "Fever" });
    expect(toast).toHaveBeenCalledWith("Leave requested — waiting for approval", "success");
  });

  it("sends a run of days one per day, and says which didn't go through", async () => {
    const from = addDays(today, 3);
    leaves.mockResolvedValue([leave({ date: addDays(today, 4), status: "approved" })]);
    applyLeave.mockImplementation(({ date }: { date: string }) =>
      date === addDays(today, 5) ? Promise.reject(new ApiError("exists", 409)) : Promise.resolve({ success: true })
    );
    renderPage("/my/leave?apply=1");
    const fromInput = await screen.findByLabelText(/^from$/i);
    await userEvent.clear(fromInput);
    await userEvent.type(fromInput, from);
    await userEvent.type(screen.getByLabelText(/to \(optional\)/i), addDays(today, 6));
    await userEvent.type(screen.getByLabelText(/reason/i), "Wedding");
    await userEvent.click(screen.getByRole("button", { name: /apply for 4 days/i }));

    expect(await screen.findByText("2 of 4 days were requested.")).toBeInTheDocument();
    // The approved day was never sent; the server said the other was already there.
    expect(applyLeave).toHaveBeenCalledTimes(3);
    expect(screen.getByText("already requested (approved)")).toBeInTheDocument();
    expect(screen.getByText("already requested")).toBeInTheDocument();
  });

  it("asks for a reason, and refuses more than 14 days at once", async () => {
    leaves.mockResolvedValue([]);
    renderPage("/my/leave?apply=1");
    await userEvent.click(await screen.findByRole("button", { name: /^apply$/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/say briefly why/i);
    await userEvent.type(screen.getByLabelText(/to \(optional\)/i), addDays(today, 20));
    await userEvent.type(screen.getByLabelText(/reason/i), "Long trip");
    await userEvent.click(screen.getByRole("button", { name: /apply for 20 days/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/at most 14 days/i);
    expect(applyLeave).not.toHaveBeenCalled();
  });
});

describe("dates", () => {
  it("run from the first day to the last, both included", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});
