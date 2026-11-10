import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { useUiStore } from "@/core/ui/uiStore";

// ══════════════════════════════════════════════════════════════════
//  THE MENU SAYS WHAT IS WAITING, AND KEEPS YOUR PAGES AT THE TOP
//
//  Counts come from the dashboard's attention list, on the entry that
//  clears each one; pins put a person's own pages first. A pin never
//  shows a page the person may not open, and an employee login has
//  neither (its menu is its own).
// ══════════════════════════════════════════════════════════════════

let user: Record<string, unknown> = { _id: "u1", name: "Owner", role: "admin", department: "admin" };
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user }) }));
const overview = vi.fn();
vi.mock("@/features/dashboard/hooks", () => ({
  useDashboardOverview: (enabled: boolean) => overview(enabled),
}));

import { Sidebar } from "./Sidebar";

const attention = [
  { key: "ordersAtRisk", label: "Orders at risk", count: 2, tone: "danger", to: "/orders", items: [] },
  { key: "billsDue", label: "Bills due", count: 3, tone: "warning", to: "/accounts/bills", items: [] },
  { key: "expenses", label: "Expenses to approve", count: 1, tone: "warning", to: "/accounts/expenses?status=pending", items: [] },
];

const show = () =>
  render(
    <MemoryRouter>
      <Sidebar mobileOpen={false} onMobileClose={() => {}} />
    </MemoryRouter>
  );

beforeEach(() => {
  user = { _id: "u1", name: "Owner", role: "admin", department: "admin" };
  overview.mockReset();
  overview.mockReturnValue({ data: { attention } });
  useUiStore.setState({ navPinned: [], navHidden: [], navOrder: {} });
});

describe("counts on the menu", () => {
  it("puts each count on the entry that clears it, adding up an entry's items", () => {
    show();
    expect(screen.getByRole("link", { name: "Orders, Orders at risk: 2" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Accounts, Bills due: 3, Expenses to approve: 1" })).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /^Accounts/ })).getByText("4")).toBeInTheDocument();
  });

  it("an entry with nothing waiting is just its name", () => {
    show();
    expect(screen.getByRole("link", { name: "Invoices" })).toBeInTheDocument();
  });

  it("an employee login doesn't ask for the plant's figures at all", () => {
    user = { _id: "u2", name: "Ravi", role: "employee", selfService: true, employeeId: "e1" };
    overview.mockReturnValue({});
    show();
    expect(overview).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("button", { name: /^pin /i })).not.toBeInTheDocument();
  });
});

describe("pinning", () => {
  it("pins an entry to the top, and unpins it", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "Pin Invoices to the top" }));
    expect(screen.getByText("Pinned")).toBeInTheDocument();
    // First in the menu, and still in its own section.
    expect(screen.getAllByRole("link")[0]).toHaveAccessibleName("Invoices");
    expect(screen.getAllByRole("link", { name: "Invoices" })).toHaveLength(2);
    expect(useUiStore.getState().navPinned).toEqual(["/invoices"]);

    await userEvent.click(screen.getAllByRole("button", { name: "Unpin Invoices" })[0]);
    expect(screen.queryByText("Pinned")).not.toBeInTheDocument();
  });

  it("never shows a pinned page the person may no longer open", () => {
    user = { _id: "u3", name: "Floor", role: "production", department: "production" };
    useUiStore.setState({ navPinned: ["/payroll"] });
    show();
    expect(screen.queryByText("Pinned")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /payroll/i })).not.toBeInTheDocument();
  });
});
