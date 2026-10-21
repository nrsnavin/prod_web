import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DispatchQueuePage } from "./DispatchQueuePage";
import { DispatchItem } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE DISPATCH QUEUE SCREEN
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const setUrgency = vi.fn();
const markDispatched = vi.fn();
const remove = vi.fn();
let user: { role: string; department: string } = { role: "marketing", department: "marketing" };
let queue: { items: DispatchItem[]; counts?: { awaiting: number; queued: number; late: number } } = { items: [] };

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user }) }));
vi.mock("./hooks", () => ({
  useDispatchQueue: () => ({ data: { now: new Date().toISOString(), ...queue }, isLoading: false, isError: false }),
  useDispatchMutations: () => ({
    setUrgency: { mutate: setUrgency, isPending: false },
    markDispatched: { mutate: markDispatched, isPending: false },
    remove: { mutate: remove, isPending: false },
  }),
}));

const item = (over: Partial<DispatchItem>): DispatchItem => ({
  _id: "x", kind: "job", job: "j1", customerName: "Fellows Fashion", ref: "J-3", title: "20mm Knitted",
  quantity: 2000, orderNo: 7, status: "queued", readyAt: new Date(Date.now() - 3 * 3600e3).toISOString(),
  urgency: "today", urgencyLabel: "Today", dueAt: new Date(Date.now() + 3600e3).toISOString(), late: false,
  ...over,
});

const renderPage = () => render(<MemoryRouter><DispatchQueuePage /></MemoryRouter>);
/** The numbered rows of the queue proper. */
const queueRows = () => screen.getAllByRole("listitem").filter((li) => li.querySelector('[aria-label^="Position"]'));

beforeEach(() => {
  [toast, setUrgency, markDispatched, remove].forEach((f) => f.mockReset());
  user = { role: "marketing", department: "marketing" };
  queue = {
    counts: { awaiting: 1, queued: 2, late: 1 },
    items: [
      item({ _id: "a", ref: "J-9", status: "awaiting_urgency", urgency: null, urgencyLabel: null, dueAt: null }),
      item({ _id: "b", ref: "J-3", urgency: "today_morning", urgencyLabel: "Today morning", late: true,
        dueAt: new Date(Date.now() - 2 * 3600e3).toISOString() }),
      item({ _id: "c", ref: "Sample #12", kind: "sample", sample: "s1", job: undefined, urgency: "tomorrow", urgencyLabel: "Tomorrow" }),
    ],
  };
});

describe("asking for the urgency", () => {
  it("puts what still needs an urgency first, with the four slots to choose from", async () => {
    const u = userEvent.setup();
    renderPage();
    const group = screen.getByRole("group", { name: "Delivery urgency for J-9" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Today morning", "Today evening", "Today", "Tomorrow",
    ]);
    await u.click(within(group).getByRole("button", { name: "Today evening" }));
    expect(setUrgency.mock.calls[0][0]).toEqual({ id: "a", urgency: "today_evening" });
  });

  it("packing sees that it is waiting, not buttons to answer it", () => {
    user = { role: "production", department: "packing" };
    renderPage();
    expect(screen.queryByRole("group", { name: /Delivery urgency/ })).not.toBeInTheDocument();
    expect(screen.getByText("Awaiting urgency")).toBeInTheDocument();
    expect(screen.getByText(/waiting for marketing or admin/)).toBeInTheDocument();
  });
});

describe("the queue", () => {
  it("lists in order with position, slot and deadline, and marks the late one", () => {
    renderPage();
    const queueList = queueRows();
    expect(queueList.map((li) => li.querySelector('[aria-label^="Position"]')!.textContent)).toEqual(["1", "2"]);
    expect(within(queueList[0]).getByText("Today morning")).toBeInTheDocument();
    expect(within(queueList[0]).getByText(/^Late 2h/)).toBeInTheDocument();
    expect(within(queueList[1]).getByRole("link", { name: "Sample #12" })).toHaveAttribute("href", "/samples/s1");
    expect(screen.getByText("1 need an urgency · 2 in the queue · 1 late")).toBeInTheDocument();
  });

  it("marks one dispatched with a note", async () => {
    const u = userEvent.setup();
    renderPage();
    // In the row — not the "Dispatched" view tab above the list.
    await u.click(within(queueRows()[0]).getByRole("button", { name: /Dispatched/ }));
    await u.type(screen.getByLabelText(/Note/), "DC-41");
    await u.click(screen.getByRole("button", { name: "Mark dispatched" }));
    expect(markDispatched.mock.calls[0][0]).toEqual({ id: "b", note: "DC-41" });
  });

  it("marketing can change the slot; only admin can remove", async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(screen.getAllByRole("button", { name: /More/ })[0]);
    expect(screen.queryByRole("menuitem", { name: /Remove from queue/ })).not.toBeInTheDocument();
    await u.click(screen.getByRole("menuitem", { name: /Change to Today evening/ }));
    expect(setUrgency.mock.calls[0][0]).toEqual({ id: "b", urgency: "today_evening" });
  });

  it("admin can remove, giving a reason", async () => {
    user = { role: "admin", department: "admin" };
    const u = userEvent.setup();
    renderPage();
    await u.click(screen.getAllByRole("button", { name: /More/ })[0]);
    expect(screen.getByRole("menuitem", { name: /Remove from queue/ })).toBeInTheDocument();
  });

  it("says how things join when nothing is waiting", () => {
    queue = { counts: { awaiting: 0, queued: 0, late: 0 }, items: [] };
    renderPage();
    expect(screen.getByText("Nothing waiting to go")).toBeInTheDocument();
    expect(screen.getByText(/Jobs join when they reach packing/)).toBeInTheDocument();
  });
});
