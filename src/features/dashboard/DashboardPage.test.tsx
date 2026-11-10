import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/core/http/httpClient";
import type { DashboardOverview } from "./api";

// ══════════════════════════════════════════════════════════════════
//  HOME, BY ROLE
//
//  Four numbers each against something, then what needs you, then the
//  floor and the money. An order forecast late counts as at risk; a
//  figure not recorded yet says so instead of showing zero; a screen
//  the person can't open is never linked.
// ══════════════════════════════════════════════════════════════════

let overview: { data?: DashboardOverview; isLoading: boolean; isError: boolean; error: unknown; isFetching: boolean; refetch: () => void };
let dept = "admin";
vi.mock("./hooks", () => ({
  useDashboardOverview: () => overview,
  useDashboardKpis: () => ({ data: { attendanceToday: { totalMarked: 0, totalEmployees: 24, unmarked: 24, attendancePct: 0, breakdown: { present: 0, late: 0, half_day: 0, absent: 0, on_leave: 0 } } }, isLoading: false, refetch: vi.fn() }),
  useActiveAnnouncements: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
}));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { username: "Smoke", role: dept === "production" ? "production" : "admin", department: dept } }) }));
vi.mock("@/core/ui/uiStore", () => ({ useUiStore: (sel: (s: { recent: unknown[] }) => unknown) => sel({ recent: [] }) }));
vi.mock("@/features/accounts/OpeningOnboardingCard", () => ({ OpeningOnboardingCard: () => null }));

import { DashboardPage } from "./DashboardPage";

const owner = (over: Partial<DashboardOverview> = {}): DashboardOverview => ({
  role: "owner",
  generatedAt: "2026-11-10T10:00:00Z",
  ordersAtRisk: { count: 2, late: 1, top: { orderNo: 4, orderId: "o4", detail: "due 8 Nov, 2 days late; forecast 18 Nov" } },
  attention: [
    { key: "ordersAtRisk", label: "Orders late or at risk", count: 2, tone: "danger", to: "/orders", summary: "1 late, 1 forecast late",
      items: [{ title: "Order #4 · Sunrise", detail: "due 8 Nov, 2 days late", to: "/orders/o4" }, { title: "Order #7 · Sunrise", detail: "due 15 Nov, forecast 19 Nov", to: "/orders/o7" }] },
    { key: "shiftsToVerify", label: "Shifts to verify", count: 5, tone: "warning", to: "/shift-verification", items: [] },
    { key: "lowStock", label: "Materials below minimum", count: 4, tone: "warning", to: "/materials",
      items: [{ title: "Nylon 70D", detail: "20 of 100 minimum", to: "/materials/m1" }] },
  ],
  money: {
    receivable: { total: 815000, overdue: 192000, overdueDocs: 3, docs: 9 },
    payable: { total: 240000, dueThisWeek: 60000, dueThisWeekDocs: 2 },
    sales: { monthToDate: 410000, invoices: 6, lastMonthSameDays: 380000, throughDay: 10 },
  },
  floor: {
    looms: { total: 4, running: 2, loading: 1, maintenance: 1 },
    metres: { today: 420, perWorkingDay: 1386, previousPerWorkingDay: 1319, days: 12, previousDays: 12, series: [{ date: "2026-11-01", metres: 1300 }, { date: "2026-11-02", metres: 1400 }] },
  },
  ...over,
});

const open = () => render(<MemoryRouter><DashboardPage /></MemoryRouter>);

beforeEach(() => {
  dept = "admin";
  overview = { data: owner(), isLoading: false, isError: false, error: null, isFetching: false, refetch: vi.fn() };
});

describe("the owner's home", () => {
  it("leads with orders at risk from the forecast, metres against the days before, money and looms", () => {
    open();
    const risk = screen.getByText("Orders at risk").closest("a")!;
    expect(risk).toHaveAttribute("href", "/orders");
    expect(risk).toHaveTextContent("Order #4: due 8 Nov, 2 days late; forecast 18 Nov");
    const metres = screen.getByText("Metres a working day").closest("a")!;
    expect(metres).toHaveTextContent("1,386m");
    expect(metres).toHaveTextContent("5.1%vs the 12 working days before");
    expect(screen.getByText("To collect", { selector: "p" }).closest("a")).toHaveTextContent("₹1.92 L overdue · 3 invoices");
    expect(screen.getByText("Looms weaving").closest("a")).toHaveTextContent("2of 4");
  });

  it("lists what needs a decision, with examples and the screen that clears each", () => {
    open();
    const list = screen.getByRole("heading", { name: "Needs you" }).closest("section, div")!.parentElement!;
    const risk = within(list).getByLabelText("Orders late or at risk: 2");
    expect(risk).toHaveTextContent("1 late, 1 forecast late");
    expect(within(risk).getByRole("link", { name: "Order #4 · Sunrise" })).toHaveAttribute("href", "/orders/o4");
    expect(within(risk).getByRole("link", { name: "Review: Orders late or at risk" })).toHaveAttribute("href", "/orders");
    expect(within(list).getByLabelText("Materials below minimum: 4")).toHaveTextContent("and 3 more");
  });

  it("says a register not yet taken is not zero attendance", () => {
    open();
    expect(screen.getByText("Not marked yet")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("says plainly when nothing is waiting", () => {
    overview.data = owner({ attention: [] });
    open();
    expect(screen.getByText("Nothing is waiting on you.")).toBeInTheDocument();
  });

  it("says metres not recorded yet rather than showing zero", () => {
    overview.data = owner({ floor: { looms: { total: 2, running: 0, loading: 0, maintenance: 0 }, metres: { today: 0, perWorkingDay: null, previousPerWorkingDay: null, days: 0, previousDays: 0, series: [] } } });
    open();
    expect(screen.getByText("Metres a working day").closest("a")).toHaveTextContent("—Not recorded yet");
  });
});

describe("production's home", () => {
  it("shows the floor and its queue, and never links into a screen it can't open", () => {
    dept = "production";
    overview.data = owner({ role: "production", money: undefined });
    open();
    expect(screen.getByText("Metres so far today", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText("To collect")).not.toBeInTheDocument();
    // The order book is not production's: the risk is told, not linked.
    expect(screen.getByText("Orders at risk").closest("a")).toBeNull();
    expect(screen.queryByRole("link", { name: "Order #4 · Sunrise" })).not.toBeInTheDocument();
    expect(screen.getByText("Order #4 · Sunrise")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Verify: Shifts to verify" })).toHaveAttribute("href", "/shift-verification");
  });
});

describe("a login without a plant dashboard", () => {
  it("shows no figures and no error, only what is theirs", () => {
    overview = { data: undefined, isLoading: false, isError: true, error: new ApiError("Forbidden", 403), isFetching: false, refetch: vi.fn() };
    open();
    expect(screen.queryByText("Needs you")).not.toBeInTheDocument();
    expect(screen.queryByText(/couldn't load/i)).not.toBeInTheDocument();
  });
});
