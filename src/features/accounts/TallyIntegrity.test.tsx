import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ChecksTab } from "./ChecksTab";
import { ConnectorCard, ReconcileCard } from "./TallyLink";
import type { BooksHealth, TallyReconcile } from "./types";

// The books checked against themselves and against Tally: what drifted,
// with the fix an admin can run; the connector's state; Tally's balances.

const health: BooksHealth = {
  ranAt: "2026-11-03T10:00:00Z",
  checks: [
    { key: "derived", label: "Paid, credited and unallocated figures match their vouchers and notes", severity: "critical", explain: "A document's running figure differs.", fix: "repair", ok: false, count: 1, rows: [{ docNo: "INV/2026-27/0007", field: "paidAmount", stored: 6000, expected: 4000 }] },
    { key: "cancelled", label: "Cancelled here after going to Tally", severity: "warning", explain: "Still live in Tally.", fix: null, ok: true, count: 0, rows: [] },
  ],
};
const reconcile: TallyReconcile = {
  snapshot: { at: new Date().toISOString(), company: "Balu Elastics", count: 120 },
  parties: [{ partyType: "customer", party: "c1", name: "Sunrise", tallyName: "", inTally: true, app: 21000, appSent: 10500, tally: 10000, difference: -500, unsent: 1 }],
  banks: [],
  missing: [{ ledger: "Sunrise Garments", near: ["SUNRISE GARMENTS"] }],
  onlyInTally: [],
};
const repair = vi.fn(async (_k: string) => ({ success: true, fixed: 1 }));
vi.mock("./api", () => ({
  accountsService: {
    booksHealth: async () => health,
    booksRepair: (k: string) => repair(k),
    tallyReconcile: async () => reconcile,
    tallyConnector: async () => ({ configured: true, online: false, lastSeenAt: new Date(Date.now() - 10 * 60_000).toISOString(), tallyOk: false, version: "1.0.0" }),
    tallyConnectorKey: vi.fn(), tallyConnectorRevoke: vi.fn(), tallyConnectorScript: vi.fn(),
  },
}));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

describe("the books and Tally, checked", () => {
  it("lists what drifted with what it should be, and an admin puts it back", async () => {
    wrap(<ChecksTab />);
    const list = await screen.findByLabelText("Books checks");
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(list).toHaveTextContent("INV/2026-27/0007");
    expect(list).toHaveTextContent("6,000.00");
    expect(list).toHaveTextContent("4,000.00");
    expect(within(list).getAllByLabelText("fine")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /put the figures back/i }));
    expect(repair).toHaveBeenCalledWith("repair");
  });

  it("says the connector is offline, and where Tally differs from what was sent", async () => {
    wrap(<><ConnectorCard isAdmin /><ReconcileCard /></>);
    expect(await screen.findByText("connector offline")).toBeInTheDocument();
    expect(screen.getByText(/last heard 10 min ago/)).toBeInTheDocument();
    expect(await screen.findByText(/Parties whose balance differs \(1\)/)).toBeInTheDocument();
    expect(screen.getByText("-500.00")).toBeInTheDocument();
    expect(screen.getByText(/Ledgers the next export needs that Tally does not have/)).toBeInTheDocument();
    expect(screen.getByText("SUNRISE GARMENTS")).toBeInTheDocument();
  });
});
